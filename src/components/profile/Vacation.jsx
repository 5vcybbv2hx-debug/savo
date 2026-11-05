import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar, Check, X, Clock, FileText, Plus } from 'lucide-react';
import VacationTaxReport from '@/components/vacation/VacationTaxReport';
import VacationBalanceCard from '@/components/vacation/VacationBalanceCard';
import VacationRequestDialog from '@/components/vacation/VacationRequestDialog';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { LoadingState, ListSkeleton, ErrorState } from '@/components/ui/StateDisplay';
import { getVacationBalances, isVacationEligible, loadOpeningHours } from '@/lib/vacationBalance';

const statusConfig = {
    'beantragt': { label: 'Beantragt', color: 'bg-blue-100 text-blue-700', icon: Clock },
    'genehmigt': { label: 'Genehmigt', color: 'bg-green-100 text-green-700', icon: Check },
    'abgelehnt': { label: 'Abgelehnt', color: 'bg-red-100 text-red-700', icon: X }
};

const typeColors = {
    'Urlaub': 'bg-amber-100 text-amber-700',
    'Krankheit': 'bg-red-100 text-red-700',
    'Sonderurlaub': 'bg-purple-100 text-purple-700'
};

export default function Vacation() {
    const queryClient = useQueryClient();
    const permissions = usePermissions();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const { data: user } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me(),
        staleTime: STALE.SLOW,
    });

    const { data: allVacationRequests = [] } = useQuery({
        queryKey: ['vacation-requests'],
        queryFn: () => base44.entities.VacationRequest.list('-created_date', 1000),
        staleTime: STALE.MEDIUM,
    });

    // Client-seitiger Jahresfilter
    const vacationRequests = allVacationRequests.filter(r =>
        r.start_date >= `${selectedYear}-01-01` && r.start_date <= `${selectedYear}-12-31`
    );

    const { data: allEmployees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
        staleTime: STALE.MEDIUM,
    });

    // Get current employee from cached user
    const currentEmployee =
        allEmployees.find(e => e.email === user?.email) ||
        allEmployees.find(e => e.user_id === user?.id) ||
        null;

    // Urlaubskonto nur für Festangestellte (Rollen Vollzeit & Manager)
    const isEligible = isVacationEligible(currentEmployee);

    // Öffnungstage für die Tageszählung (Ruhetage zählen nicht als Urlaubstag)
    const { data: openingHours } = useQuery({
        queryKey: ['vacation-opening-hours'],
        queryFn: () => loadOpeningHours(),
        staleTime: STALE.SLOW,
    });

    const eligibleEmployees = allEmployees.filter(isVacationEligible);

    // Gemeinsamer Datenstand für Kontokarte und Manager-Übersicht
    const balanceIds = React.useMemo(() => {
        const ids = eligibleEmployees.map(e => e.id);
        if (currentEmployee?.id && !ids.includes(currentEmployee.id)) ids.push(currentEmployee.id);
        return ids;
    }, [eligibleEmployees, currentEmployee?.id]);

    const { data: balances = {} } = useQuery({
        queryKey: ['vacation-balances', balanceIds.join(','), selectedYear],
        queryFn: () => getVacationBalances(balanceIds, selectedYear),
        enabled: balanceIds.length > 0,
        staleTime: STALE.MEDIUM,
    });

    const balance = currentEmployee ? balances[currentEmployee.id] ?? null : null;

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.VacationRequest.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
            queryClient.invalidateQueries({ queryKey: ['vacation-balances'] });
            setModalOpen(false);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.VacationRequest.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
            queryClient.invalidateQueries({ queryKey: ['vacation-balances'] });
        }
    });

    const withdrawMutation = useMutation({
        mutationFn: (id) => base44.entities.VacationRequest.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
            queryClient.invalidateQueries({ queryKey: ['vacation-balances'] });
        }
    });

    // Tage werden im Dialog aus den Öffnungstagen berechnet (halb-Tage überschreibbar)
    const handleSubmit = async ({ type, notes, periods }) => {
        if (!currentEmployee) return;
        await Promise.all(periods.map(period => createMutation.mutateAsync({
            employee_id: currentEmployee.id,
            employee_name: currentEmployee.name,
            start_date: period.start_date,
            end_date: period.end_date,
            days_count: period.days_count,
            type,
            notes,
            status: 'beantragt',
        })));
        setModalOpen(false);
    };

    const handleApprove = async (request) => {
        await updateMutation.mutateAsync({
            id: request.id,
            data: {
                status: 'genehmigt',
                approved_by: user?.full_name,
                approved_date: new Date().toISOString()
            }
        });
    };

    const handleReject = async (request) => {
        await updateMutation.mutateAsync({
            id: request.id,
            data: {
                status: 'abgelehnt',
                reviewed_by: user?.full_name,
                reviewed_date: new Date().toISOString()
            }
        });
    };

    // Filter requests based on permissions
    const visibleRequests = permissions.isManager 
        ? vacationRequests 
        : vacationRequests.filter(r => r.employee_id === currentEmployee?.id);

    // Kontostand je Festangestelltem für die Manager-Übersicht
    const employeeStats = {};
    eligibleEmployees.forEach(emp => {
        const empBalance = balances[emp.id];
        if (!empBalance) return;
        employeeStats[emp.id] = {
            name: emp.name,
            used: empBalance.used,
            total: empBalance.entitlement + empBalance.carryover,
            remaining: empBalance.available
        };
    });

    const pendingRequests = visibleRequests.filter(r => r.status === 'beantragt');
    const [showTaxReport, setShowTaxReport] = React.useState(false);

    if (false) return (  // vacationError removed — no error state from query
        <div className="min-h-screen bg-background px-4 py-6">
            <ErrorState text="Urlaubsanträge konnten nicht geladen werden." retry={() => window.location.reload()} />
        </div>
    );

    if (permissions.isLoading) return (
        <div className="min-h-screen bg-background p-4 space-y-4">
            <ListSkeleton count={1} height="h-12" />
            <ListSkeleton count={3} height="h-32" />
        </div>
    );

    if (!permissions.isLoading && !permissions.canViewVacation) {
        return <PermissionDenied message="Urlaub ist für deine Rolle nicht verfügbar." />;
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Urlaubsverwaltung</h1>
                        <p className="page-subtitle">
                            {selectedYear} · {pendingRequests.length} offene Anträge
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {permissions.isManager && (
                            <Button
                                variant="outline"
                                onClick={() => setShowTaxReport(!showTaxReport)}
                                className="border-border text-muted-foreground hover:bg-accent"
                            >
                                <FileText className="w-4 h-4 mr-2" />
                                Steuerberater-Auswertung
                            </Button>
                        )}
                        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                            <SelectTrigger className="w-32 bg-card border-border text-foreground">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={(selectedYear - 1).toString()}>{selectedYear - 1}</SelectItem>
                                <SelectItem value={selectedYear.toString()}>{selectedYear}</SelectItem>
                                <SelectItem value={(selectedYear + 1).toString()}>{selectedYear + 1}</SelectItem>
                            </SelectContent>
                        </Select>
                        {currentEmployee && (
                            <Button 
                                onClick={() => setModalOpen(true)}
                                className="bg-primary hover:bg-primary/90"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Urlaub beantragen
                            </Button>
                        )}
                    </div>
                </div>

                {/* Urlaubskonto — nur Festangestellte */}
                {isEligible ? (
                    <VacationBalanceCard balance={balance} year={selectedYear} />
                ) : currentEmployee && (
                    <Card className="p-4 mb-6 bg-card border-border">
                        <p className="text-sm font-semibold text-foreground">
                            Urlaubskonto gilt für Festangestellte
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Du kannst deinen Urlaub weiterhin beantragen — ein Resturlaub-Saldo wird für Aushilfen nicht geführt.
                        </p>
                    </Card>
                )}

                {/* Tax Report for Steuerberater */}
                {showTaxReport && permissions.isManager && (
                    <VacationTaxReport
                        vacationRequests={vacationRequests}
                        employees={allEmployees}
                        selectedYear={selectedYear}
                    />
                )}

                {/* Manager: Employee Overview */}
                {permissions.isManager && (
                    <Card className="p-6 bg-card border-border mb-6">
                        <h2 className="text-lg font-semibold text-foreground mb-4">Mitarbeiter-Übersicht</h2>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {eligibleEmployees.map(emp => {
                                const stats = employeeStats[emp.id];
                                if (!stats) return null;
                                return (
                                    <div key={emp.id} className="p-4 bg-background rounded-lg border border-border">
                                        <p className="font-medium text-foreground mb-2">{stats.name}</p>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Genommen:</span>
                                            <span className="text-foreground">{stats.used} Tage</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Verfügbar:</span>
                                            <span className={cn(
                                                "font-semibold",
                                                stats.remaining < 5 ? "text-orange-400" : "text-green-400"
                                            )}>
                                                {stats.remaining} Tage
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                )}

                {/* Requests */}
                <div className="space-y-4">
                    {visibleRequests.length > 0 ? (
                        visibleRequests
                            .sort((a, b) => b.start_date.localeCompare(a.start_date))
                            .map(request => {
                                const StatusIcon = statusConfig[request.status].icon;
                                return (
                                    <Card key={request.id} className="p-5 bg-card border-border">
                                        <div className="flex items-start justify-between">
                                             <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="font-semibold text-foreground">
                                                        {request.employee_name}
                                                    </span>
                                                    <Badge className={typeColors[request.type]}>
                                                        {request.type}
                                                    </Badge>
                                                    <Badge className={statusConfig[request.status].color}>
                                                        <StatusIcon className="w-3 h-3 mr-1" />
                                                        {statusConfig[request.status].label}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-4 h-4" />
                                                        <span>
                                                            {format(parseISO(request.start_date), 'dd.MM.yyyy', { locale: de })}
                                                            {' - '}
                                                            {format(parseISO(request.end_date), 'dd.MM.yyyy', { locale: de })}
                                                        </span>
                                                    </div>
                                                    <span className="font-semibold text-amber-400">
                                                        {request.days_count} Tage
                                                    </span>
                                                </div>
                                                {request.notes && (
                                                    <p className="text-sm text-muted-foreground mt-2">{request.notes}</p>
                                                )}
                                                {request.approved_by && (
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        {request.status === 'genehmigt' ? 'Genehmigt' : 'Abgelehnt'} von {request.approved_by}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2 items-end">
                                                {permissions.isManager && request.status === 'beantragt' && (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            onClick={() => handleApprove(request)}
                                                            size="sm"
                                                            className="bg-green-600 hover:bg-green-700"
                                                        >
                                                            <Check className="w-4 h-4 mr-1" />
                                                            Genehmigen
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleReject(request)}
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                                                        >
                                                            <X className="w-4 h-4 mr-1" />
                                                            Ablehnen
                                                        </Button>
                                                    </div>
                                                )}
                                                {request.employee_id === currentEmployee?.id && 
                                                 (request.status === 'beantragt' || request.status === 'genehmigt') && (
                                                    <Button
                                                        onClick={() => {
                                                            if (confirm('Urlaubsantrag wirklich zurückziehen?')) {
                                                                withdrawMutation.mutate(request.id);
                                                            }
                                                        }}
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-orange-600 text-orange-400 hover:bg-orange-600 hover:text-white"
                                                    >
                                                        <X className="w-4 h-4 mr-1" />
                                                        Zurückziehen
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })
                    ) : (
                        <Card className="p-12 bg-card border-border">
                            <div className="text-center text-muted-foreground">
                                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>Keine Urlaubsanträge für {selectedYear}</p>
                            </div>
                        </Card>
                    )}
                </div>

                {/* Antragsdialog mit Resturlaub-Vorschau */}
                {openingHours && (
                    <VacationRequestDialog
                        open={modalOpen}
                        onOpenChange={setModalOpen}
                        balance={isEligible ? balance : null}
                        openingHours={openingHours}
                        onSubmit={handleSubmit}
                        isSubmitting={createMutation.isPending}
                    />
                )}
            </div>
        </div>
    );
}