import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { STALE } from '@/lib/queryUtils';;
import { format, parseISO, differenceInBusinessDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar, Plus, Check, X, Clock, AlertCircle, FileText, Trash2 } from 'lucide-react';
import VacationTaxReport from '@/components/vacation/VacationTaxReport';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { LoadingState, ListSkeleton, ErrorState } from '@/components/ui/StateDisplay';

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
    const [formData, setFormData] = useState({
        type: 'Urlaub',
        notes: '',
        periods: [{ start_date: '', end_date: '' }]
    });

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

    // Check if current employee is full-time
    const isFullTimeEmployee = currentEmployee?.contract_type === 'Vollzeit';
    
    // Filter to show only full-time and part-time employees for vacation stats
    const fullTimeEmployees = allEmployees.filter(e => 
        ['Vollzeit', 'Teilzeit'].includes(e.contract_type) && e.vacation_days_per_year > 0
    );

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.VacationRequest.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
            setModalOpen(false);
            resetForm();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.VacationRequest.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
        }
    });

    const withdrawMutation = useMutation({
        mutationFn: (id) => base44.entities.VacationRequest.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vacation-requests'] })
    });

    const calculateBusinessDays = (start, end) => {
        return differenceInBusinessDays(new Date(end), new Date(start)) + 1;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const validPeriods = formData.periods.filter(p => p.start_date && p.end_date);
        if (validPeriods.length === 0) return;

        // Create one request per period
        const promises = validPeriods.map(period => {
            const daysCount = calculateBusinessDays(period.start_date, period.end_date);
            return createMutation.mutateAsync({
                employee_id: currentEmployee.id,
                employee_name: currentEmployee.name,
                start_date: period.start_date,
                end_date: period.end_date,
                days_count: daysCount,
                type: formData.type,
                notes: formData.notes,
                status: 'beantragt'
            });
        });

        Promise.all(promises).then(() => {
            setModalOpen(false);
            resetForm();
        });
    };

    const addPeriod = () => {
        setFormData(prev => ({
            ...prev,
            periods: [...prev.periods, { start_date: '', end_date: '' }]
        }));
    };

    const removePeriod = (index) => {
        setFormData(prev => ({
            ...prev,
            periods: prev.periods.filter((_, i) => i !== index)
        }));
    };

    const updatePeriod = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            periods: prev.periods.map((p, i) => i === index ? { ...p, [field]: value } : p)
        }));
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

    const resetForm = () => {
        setFormData({
            type: 'Urlaub',
            notes: '',
            periods: [{ start_date: '', end_date: '' }]
        });
    };

    // Filter requests based on permissions
    const visibleRequests = permissions.isManager 
        ? vacationRequests 
        : vacationRequests.filter(r => r.employee_id === currentEmployee?.id);

    // Calculate stats per employee (only for full-time)
    const employeeStats = {};
    fullTimeEmployees.forEach(emp => {
        const empRequests = vacationRequests.filter(r => 
            r.employee_id === emp.id && r.status === 'genehmigt' && r.type === 'Urlaub'
        );
        const usedDays = empRequests.reduce((sum, r) => sum + r.days_count, 0);
        const totalDays = emp.vacation_days_per_year || 30; // Individuelle Tage oder Standard
        employeeStats[emp.id] = {
            name: emp.name,
            used: usedDays,
            total: totalDays,
            remaining: totalDays - usedDays
        };
    });

    const currentEmployeeStats = currentEmployee ? employeeStats[currentEmployee.id] : null;
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

    if (!permissions.isLoading && (!permissions.canViewVacation || (!permissions.isManager && !isFullTimeEmployee))) {
        return <PermissionDenied message="Urlaub ist für Aushilfen nicht verfügbar. Nutze die 'Nicht verfügbar'-Funktion im Schichtplan." />;
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Urlaubsverwaltung</h1>
                        <p className="text-muted-foreground text-sm mt-1">
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
                        {currentEmployee && isFullTimeEmployee && (
                            <Button 
                                onClick={() => setModalOpen(true)}
                                className="bg-amber-600 hover:bg-amber-700"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Urlaub beantragen
                            </Button>
                        )}
                    </div>
                </div>

                {/* Stats Card */}
                {currentEmployeeStats && (
                    <Card className="p-6 bg-card border-border mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Dein Urlaubskonto {selectedYear}</p>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-3xl font-bold text-foreground">
                                        {currentEmployeeStats.remaining}
                                    </span>
                                    <span className="text-muted-foreground">von {currentEmployeeStats.total} Tagen</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground mb-1">Genommen</p>
                                <p className="text-2xl font-semibold text-amber-400">
                                    {currentEmployeeStats.used} Tage
                                </p>
                            </div>
                        </div>
                        {currentEmployeeStats.remaining < 5 && (
                            <div className="mt-4 flex items-center gap-2 text-orange-400 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                Weniger als 5 Tage verfügbar
                            </div>
                        )}
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
                            {fullTimeEmployees.map(emp => {
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

                {/* Modal */}
                <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Urlaub beantragen</DialogTitle>
                        </DialogHeader>
                        
                        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>Art</Label>
                                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Urlaub">Urlaub</SelectItem>
                                        <SelectItem value="Krankheit">Krankheit</SelectItem>
                                        <SelectItem value="Sonderurlaub">Sonderurlaub</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Zeiträume</Label>
                                    <Button type="button" variant="outline" size="sm" onClick={addPeriod} className="text-xs h-7">
                                        <Plus className="w-3 h-3 mr-1" />
                                        Zeitraum hinzufügen
                                    </Button>
                                </div>

                                {formData.periods.map((period, index) => (
                                    <div key={index} className="p-3 border border-border rounded-lg space-y-2 bg-background/50">
                                         <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground font-medium">
                                                 Zeitraum {index + 1}
                                                {period.start_date && period.end_date && (
                                                    <span className="ml-2 text-amber-400">
                                                         · {calculateBusinessDays(period.start_date, period.end_date)} Tage
                                                    </span>
                                                 )}
                                            </span>
                                             {formData.periods.length > 1 && (
                                                 <button type="button" onClick={() => removePeriod(index)} className="text-red-400 hover:text-red-300">
                                                     <Trash2 className="w-3.5 h-3.5" />
                                                 </button>
                                             )}
                                        </div>
                                         <div className="grid grid-cols-2 gap-2">
                                             <div>
                                                 <Label className="text-xs text-muted-foreground">Von *</Label>
                                                <Input
                                                    type="date"
                                                    value={period.start_date}
                                                    onChange={(e) => updatePeriod(index, 'start_date', e.target.value)}
                                                    required
                                                    className="mt-1"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-muted-foreground">Bis *</Label>
                                                <Input
                                                    type="date"
                                                    value={period.end_date}
                                                    onChange={(e) => updatePeriod(index, 'end_date', e.target.value)}
                                                    required
                                                    className="mt-1"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {formData.periods.filter(p => p.start_date && p.end_date).length > 1 && (
                                    <div className="p-2 bg-amber-900/20 border border-amber-700/50 rounded text-xs text-amber-300 text-center">
                                        Gesamt: {formData.periods
                                            .filter(p => p.start_date && p.end_date)
                                            .reduce((sum, p) => sum + calculateBusinessDays(p.start_date, p.end_date), 0)
                                        } Arbeitstage · {formData.periods.filter(p => p.start_date && p.end_date).length} separate Anträge
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Notizen</Label>
                                <Textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Optional: Grund oder Hinweise..."
                                    rows={2}
                                />
                            </div>

                            <div className="flex gap-2 pt-4">
                                <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">
                                    Abbrechen
                                </Button>
                                <Button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700">
                                    {formData.periods.filter(p => p.start_date && p.end_date).length > 1
                                        ? `${formData.periods.filter(p => p.start_date && p.end_date).length} Anträge einreichen`
                                        : 'Beantragen'
                                    }
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}