import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Users, Check, X, AlertCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  sortBidsByTimestamp, 
  groupBidsByStatus, 
  formatBidTime, 
  getStatusLabel, 
  getStatusColor,
  invalidateAllSwapQueries,
} from '@/lib/shiftSwapHelpers';
import { cn } from "@/lib/utils";

export default function ShiftMarketplaceModal({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [expandedRequest, setExpandedRequest] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true })
  });

  const { data: availableShifts = [], isLoading } = useQuery({
    queryKey: ['available-shift-swaps'],
    queryFn: async () => {
      const [offen, ausstehend] = await Promise.all([
        base44.entities.ShiftSwapRequest.filter({ status: 'offen', marketplace: true }),
        base44.entities.ShiftSwapRequest.filter({ status: 'ausstehend', marketplace: true }),
      ]);
      const requests = [...offen, ...ausstehend];
      return requests;
    }
  });

  const { data: allBids = [] } = useQuery({
    queryKey: ['shift-swap-bids'],
    queryFn: () => base44.entities.ShiftSwapBid.list('-created_at', 500)
  });

  const { data: myBids = [] } = useQuery({
    queryKey: ['my-bids'],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const currentEmployee = employees.find(e => e.email === currentUser.email);
      if (!currentEmployee) return [];
      return base44.entities.ShiftSwapBid.filter({ 
        bidding_employee_id: currentEmployee.id
      });
    },
    enabled: !!currentUser?.email && employees.length > 0
  });

  const bidMutation = useMutation({
    mutationFn: async ({ swapRequestId, status }) => {
      const currentEmployee = employees.find(e => e.email === currentUser?.email);
      if (!currentEmployee) throw new Error('Mitarbeiter nicht gefunden');

      const request = availableShifts.find(s => s.id === swapRequestId);
      if (!request) throw new Error('Anfrage nicht gefunden');

      // Prüfe ob Mitarbeiter bereits reagiert hat
      const existingBid = allBids.find(b => 
        b.swap_request_id === swapRequestId && 
        b.bidding_employee_id === currentEmployee.id
      );

      if (existingBid) {
        // Aktualisiere existierende Reaktion
        await base44.entities.ShiftSwapBid.update(existingBid.id, {
          status: status,
          created_at: new Date().toISOString()
        });
      } else {
        // Erstelle neue Reaktion
        await base44.entities.ShiftSwapBid.create({
          swap_request_id: swapRequestId,
          bidding_employee_id: currentEmployee.id,
          bidding_employee_name: currentEmployee.name,
          shift_id: request.shift_id,
          status: status,
          created_at: new Date().toISOString()
        });
      }

      // Benachrichtigung an Manager (Rollen-Broadcast, kein Empfänger im Sinne
      // von recipient_id, da nicht klar ist welcher Manager gerade zuständig
      // ist — alle Manager/Admins sollen reagieren können)
      try {
        const statusLabel = getStatusLabel(status);
        await base44.entities.Notification.create({
          type: 'general',
          category: 'schicht',
          title: `Neue Reaktion auf Schichttausch (${statusLabel})`,
          message: `${currentEmployee.name} hat auf deine Anfrage am ${format(parseISO(request.shift_date), 'dd.MM.yyyy', { locale: de })} reagiert: ${statusLabel}`,
          related_id: swapRequestId,
          target_roles: ['admin', 'manager'],
          read_by: []
        });
      } catch (error) {
        console.error('Fehler bei Benachrichtigung:', error);
      }
    },
    onSuccess: () => {
      invalidateAllSwapQueries(queryClient);
      toast.success('Reaktion gespeichert!');
    },
    onError: (error) => {
      toast.error('Fehler: ' + error.message);
    }
  });

  const currentEmployee = employees.find(e => e.email === currentUser?.email);
  
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl max-h-[85vh] overflow-y-auto p-0 sm:p-6">
        <DialogHeader className="p-4 sm:p-0 sticky top-0 z-10 bg-background border-b border-border sm:border-0">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Users className="w-5 h-5 text-blue-600" />
            Schichttausch-Marktplatz
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 p-4 sm:p-0 sm:mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (() => {
            // Split: active shifts (not declined) vs declined shifts
            const activeShifts = availableShifts.filter(shift => {
              const myBid = myBids.find(b => b.swap_request_id === shift.id);
              return myBid?.status !== 'ablehnen';
            });
            const declinedShifts = availableShifts.filter(shift => {
              const myBid = myBids.find(b => b.swap_request_id === shift.id);
              return myBid?.status === 'ablehnen';
            });

            if (activeShifts.length === 0 && declinedShifts.length === 0) {
              return (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium text-foreground">Keine verfügbaren Angebote</p>
                  <p className="text-sm mt-1">Aktuell gibt es keine Schichten zum Tauschen</p>
                </div>
              );
            }

            return (
              <>
              {activeShifts.map(shift => {
              const requestingEmployee = employees.find(e => e.id === shift.requesting_employee_id);
              const shiftBids = allBids.filter(b => b.swap_request_id === shift.id);
              const sortedBids = sortBidsByTimestamp(shiftBids);
              const groupedBids = groupBidsByStatus(sortedBids);
              const myReaction = myBids.find(b => b.swap_request_id === shift.id);
              const isExpanded = expandedRequest === shift.id;

              return (
                <Card 
                  key={shift.id} 
                  className="p-0 overflow-hidden border-l-4 border-l-blue-500 hover:border-l-blue-600 transition-all"
                >
                  {/* Header / Anfrage-Übersicht */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {requestingEmployee?.name} sucht Tausch
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Erstellt: {format(parseISO(shift.created_date), 'dd.MM.yyyy HH:mm', { locale: de })}
                        </p>
                      </div>
                      {myReaction && (
                        <Badge className={getStatusColor(myReaction.status)}>
                          {getStatusLabel(myReaction.status)}
                        </Badge>
                      )}
                    </div>

                    {/* Schicht-Info */}
                    <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                      <p className="text-xs font-medium text-blue-400 mb-2">Schicht:</p>
                      <p className="text-sm font-semibold text-foreground">
                        {format(parseISO(shift.shift_date), 'EEEE, d. MMMM yyyy', { locale: de })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {shift.shift_time || 'Zeit nicht angegeben'}
                      </p>
                    </div>

                    {/* Grund */}
                    {shift.reason && (
                      <div className="bg-secondary rounded-lg p-3 border border-border">
                        <p className="text-xs text-muted-foreground font-medium mb-1">Grund:</p>
                        <p className="text-sm text-foreground">{shift.reason}</p>
                      </div>
                    )}

                    {/* Reaktions-Buttons (Mobile-optimiert) */}
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        onClick={() => bidMutation.mutate({ swapRequestId: shift.id, status: 'annehmen' })}
                        disabled={bidMutation.isPending}
                        size="sm"
                        className={cn(
                          "text-xs sm:text-sm h-10 sm:h-auto",
                          myReaction?.status === 'annehmen'
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                        )}
                      >
                        {bidMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Annehmen
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={() => bidMutation.mutate({ swapRequestId: shift.id, status: 'unter_umständen' })}
                        disabled={bidMutation.isPending}
                        size="sm"
                        className={cn(
                          "text-xs sm:text-sm h-10 sm:h-auto",
                          myReaction?.status === 'unter_umständen'
                            ? 'bg-yellow-600 hover:bg-yellow-700'
                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30'
                        )}
                      >
                        {bidMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">Vielleicht</span>
                            <span className="sm:hidden">?</span>
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={() => bidMutation.mutate({ swapRequestId: shift.id, status: 'ablehnen' })}
                        disabled={bidMutation.isPending}
                        size="sm"
                        className={cn(
                          "text-xs sm:text-sm h-10 sm:h-auto",
                          myReaction?.status === 'ablehnen'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        )}
                      >
                        {bidMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <X className="w-4 h-4 mr-1" />
                            Ablehnen
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Bewerber-Übersicht Toggle */}
                    {sortedBids.length > 0 && (
                      <button
                        onClick={() => setExpandedRequest(isExpanded ? null : shift.id)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 transition-colors"
                      >
                        <span className="text-xs font-medium text-muted-foreground">
                          {sortedBids.length} Reaktionen
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Bewerber-Detail (aufklappbar) */}
                  {isExpanded && sortedBids.length > 0 && (
                    <div className="border-t border-border px-4 py-3 bg-slate-500/5 space-y-2">
                      {/* Annehmen */}
                      {groupedBids.annehmen.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-green-400 mb-2 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {groupedBids.annehmen.length} möchte übernehmen
                          </p>
                          <div className="space-y-2 ml-4">
                            {groupedBids.annehmen.map((bid, idx) => (
                              <div key={bid.id} className="flex items-center justify-between text-xs">
                                <span className="text-foreground">
                                  {bid.bidding_employee_name}
                                  {idx === 0 && <span className="ml-2 text-green-400">⭐ Erste</span>}
                                </span>
                                <span className="text-muted-foreground">
                                  {formatBidTime(bid.created_at)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Unter Umständen */}
                      {groupedBids.unter_umständen.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-yellow-400 mb-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {groupedBids.unter_umständen.length} ist interessiert, aber unsicher
                          </p>
                          <div className="space-y-2 ml-4">
                            {groupedBids.unter_umständen.map(bid => (
                              <div key={bid.id} className="flex items-center justify-between text-xs">
                                <span className="text-foreground">
                                  {bid.bidding_employee_name}
                                </span>
                                <span className="text-muted-foreground">
                                  {formatBidTime(bid.created_at)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ablehnen */}
                      {groupedBids.ablehnen.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1">
                            <X className="w-3 h-3" />
                            {groupedBids.ablehnen.length} kein Interesse
                          </p>
                          <div className="space-y-2 ml-4">
                            {groupedBids.ablehnen.map(bid => (
                              <div key={bid.id} className="flex items-center justify-between text-xs">
                                <span className="text-foreground">
                                  {bid.bidding_employee_name}
                                </span>
                                <span className="text-muted-foreground">
                                  {formatBidTime(bid.created_at)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}

              {/* Abgelehnte Schichten (eingeklappt) */}
              {declinedShifts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors select-none">
                      Abgelehnt ({declinedShifts.length}) — nur sichtbar bei Bedarf
                    </summary>
                    <div className="space-y-2 mt-3">
                      {declinedShifts.map(shift => {
                        const requestingEmployee = employees.find(e => e.id === shift.requesting_employee_id);
                        return (
                          <Card key={shift.id} className="p-3 opacity-50 border-l-4 border-l-red-500">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground text-sm truncate">
                                  {requestingEmployee?.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(parseISO(shift.shift_date), 'dd.MM.yyyy', { locale: de })}
                                  {shift.shift_time ? ` • ${shift.shift_time}` : ''}
                                </p>
                              </div>
                              <Button
                                onClick={() => bidMutation.mutate({ swapRequestId: shift.id, status: 'annehmen' })}
                                disabled={bidMutation.isPending}
                                size="sm"
                                variant="outline"
                                className="text-xs h-8 shrink-0"
                              >
                                Anders überlegen?
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </details>
                </div>
              )}
              </>
            );
          })()
          }
        </div>
      </DialogContent>
    </Dialog>
  );
}