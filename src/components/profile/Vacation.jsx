import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar, Check, X, Clock, FileText, Plus, Info } from 'lucide-react';
import VacationTaxReport from '@/components/vacation/VacationTaxReport';
import VacationBalanceCard from '@/components/vacation/VacationBalanceCard';
import VacationRequestDialog from '@/components/vacation/VacationRequestDialog';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { LoadingState, ListSkeleton, ErrorState } from '@/components/ui/StateDisplay';
import { getVacationBalances, isVacationEligible, loadOpeningHours } from '@/lib/vacationBalance';

const statusConfig = {
    'beantragt': { label: 'Beantragt', color: 'bg-primary/15 text-primary', icon: Clock },
    'genehmigt': { label: 'Genehmigt', color: 'bg-status-ok/15 text-status-ok', icon: Check },
    'abgelehnt': { label: 'Abgelehnt', color: 'bg-status-danger/15 text-status-danger', icon: X }
};

const typeColors = {
    'Urlaub': 'bg-status-warn/15 text-status-warn',
    'Krankheit': 'bg-status-danger/15 text-status-danger',
    'Sonderurlaub': 'bg-primary text-primary'
};

export default function Vacation() {
    const queryClient = useQueryClient();
    const permissions = usePermissions();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [feedback, setFeedback] = useState(null);
    const [conflict, setConflict] = useState(null);
    const [highlightId, setHighlightId] = useState(null);
    const lastSubmitRef = React.useRef({ at: 0, key: '' });

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

    // Jahresauswahl: aktuelles Jahr plus alle Jahre, in denen bereits Anträge liegen
    const yearOptions = React.useMemo(() => {
        const years = new Set([new Date().getFullYear(), selectedYear]);
        allVacationRequests.forEach(r => {
            const year = Number(String(r.start_date || '').slice(0, 4));
            if (year) years.add(year);
        });
        return Array.from(years).sort((a, b) => a - b);
    }, [allVacationRequests, selectedYear]);

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

    // Bestehender, sich überschneidender Antrag (beantragt oder genehmigt)
    const findConflict = (period) => allVacationRequests.find(r =>
        r.employee_id === currentEmployee?.id &&
        (r.status === 'beantragt' || r.status === 'genehmigt') &&
        r.start_date <= period.end_date && r.end_date >= period.start_date
    );

    // Tage werden im Dialog aus den Öffnungstagen berechnet (halb-Tage überschreibbar)
    const submitPeriods = async ({ type, notes, periods }) => {
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

        const earliest = periods.reduce((min, p) => (!min || p.start_date < min ? p.start_date : min), null);
        if (earliest) setSelectedYear(Number(earliest.slice(0, 4)));

        const days = Math.round(periods.reduce((sum, p) => sum + (Number(p.days_count) || 0), 0) * 10) / 10;
        setFeedback({
            tone: 'ok',
            title: `Antrag für ${format(parseISO(earliest), 'dd.MM.yyyy', { locale: de })} eingereicht`,
            sub: `beantragt · ${days} ${days === 1 ? 'Tag' : 'Tage'}`,
        });
        setModalOpen(false);
    };

    const handleSubmit = async ({ type, notes, periods }) => {
        if (!currentEmployee || !periods?.length) return;

        // Doppelte Einreichung innerhalb von 2 Minuten blocken
        const signature = `${type}|${periods.map(p => `${p.start_date}>${p.end_date}`).join(',')}`;
        const now = Date.now();
        if (lastSubmitRef.current.key === signature && now - lastSubmitRef.current.at < 120000) {
            setFeedback({
                tone: 'info',
                title: 'Antrag wurde gerade erst eingereicht',
                sub: 'Doppelte Einreichung innerhalb von 2 Minuten wird blockiert.',
            });
            return;
        }
        lastSubmitRef.current = { at: now, key: signature };

        const existing = periods.map(findConflict).find(Boolean);
        if (existing) {
            setConflict({ type, notes, periods, existing });
            return;
        }

        await submitPeriods({ type, notes, periods });
    };

    // Bestätigung nach 6 Sekunden ausblenden
    useEffect(() => {
        if (!feedback) return;
        const timer = setTimeout(() => setFeedback(null), 6000);
        return () => clearTimeout(timer);
    }, [feedback]);

    // Verlinkter Bestandsantrag: hinscrollen und kurz hervorheben
    useEffect(() => {
        if (!highlightId) return;
        const el = document.getElementById(`vacation-request-${highlightId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const timer = setTimeout(() => setHighlightId(null), 4000);
        return () => clearTimeout(timer);
    }, [highlightId, selectedYear]);

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
                                {yearOptions.map(year => (
                                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                ))}
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

                {feedback && (
                    <div className={cn(
                        'mb-6 flex items-start gap-2 rounded-xl border px-3 py-2',
                        feedback.tone === 'ok' ? 'border-status-ok/30 bg-status-ok/10' : 'border-border bg-card'
                    )}>
                        {feedback.tone === 'ok'
                            ? <Check className="w-4 h-4 text-status-ok mt-0.5 shrink-0" />
                            : <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />}
                        <div className="min-w-0">
                            <p className="text-[13px] font-medium text-foreground">{feedback.title}</p>
                            <p className="text-[12px] text-muted-foreground mt-0.5">{feedback.sub}</p>
                        </div>
                    </div>
                )}

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
                                                stats.remaining < 5 ? "text-status-warn" : "text-status-ok"
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
                                    <Card
                                        key={request.id}
                                        id={`vacation-request-${request.id}`}
                                        className={cn(
                                            "p-5 bg-card border-border",
                                            highlightId === request.id && "ring-2 ring-primary/50"
                                        )}
                                    >
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
                                                    <span className="font-semibold text-status-warn">
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
                                                            className="bg-status-ok/70 hover:bg-status-ok/70"
                                                        >
                                                            <Check className="w-4 h-4 mr-1" />
                                                            Genehmigen
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleReject(request)}
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-status-danger/70 text-status-danger hover:bg-status-danger/70 hover:text-white"
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
                                                        className="border-status-warn/70 text-status-warn hover:bg-status-warn/70 hover:text-white"
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
                        selectedYear={selectedYear}
                        onSubmit={handleSubmit}
                        isSubmitting={createMutation.isPending}
                    />
                )}

                {/* Dublettenwarnung vor dem Absenden */}
                <AlertDialog open={!!conflict} onOpenChange={(open) => { if (!open) setConflict(null); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Antrag existiert bereits</AlertDialogTitle>
                            <AlertDialogDescription>
                                Für den {conflict ? format(parseISO(conflict.existing.start_date), 'dd.MM.yyyy', { locale: de }) : ''} existiert bereits ein Antrag ({conflict?.existing.status}). Trotzdem einreichen?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    const existing = conflict?.existing;
                                    setConflict(null);
                                    if (!existing) return;
                                    setSelectedYear(Number(String(existing.start_date).slice(0, 4)));
                                    setHighlightId(existing.id);
                                }}
                            >
                                Bestehenden Antrag ansehen
                            </Button>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    const pending = conflict;
                                    setConflict(null);
                                    if (pending) submitPeriods(pending);
                                }}
                            >
                                Trotzdem einreichen
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}