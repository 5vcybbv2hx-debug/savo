import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Calendar, User } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function SalaryHistoryModal({ employee }) {
    const { data: history = [] } = useQuery({
        queryKey: ['salary-history', employee.id],
        queryFn: () => base44.entities.SalaryHistory.filter(
            { employee_id: employee.id },
            '-effective_date'
        )
    });

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-surface">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Gehaltshistorie
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-status-ok" />
                        Gehaltshistorie - {employee.name}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    {/* Aktueller Stundensatz */}
                    <div className="p-4 bg-gradient-to-br from-status-ok/15 to-status-ok/15 border border-status-ok/25 rounded-lg">
                        <p className="text-xs text-status-ok font-semibold mb-1">AKTUELL</p>
                        <p className="text-2xl font-bold text-status-ok">
                            {employee.hourly_rate ? `${employee.hourly_rate.toFixed(2)} €/Std.` : 'Nicht festgelegt'}
                        </p>
                        <p className="text-xs text-status-ok mt-1">{employee.contract_type || 'Kein Vertrag'}</p>
                    </div>

                    {/* Historie */}
                    {history.length > 0 ? (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-muted-foreground">Änderungsverlauf</h4>
                            {history.map((entry, index) => (
                                <div 
                                    key={entry.id}
                                    className="p-4 bg-card border border-border rounded-lg"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                                <p className="text-sm font-semibold text-muted-foreground">
                                                    {format(new Date(entry.effective_date), 'dd. MMMM yyyy', { locale: de })}
                                                </p>
                                            </div>
                                            {entry.changed_by && (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <User className="w-3 h-3 text-muted-foreground" />
                                                    <p className="text-xs text-muted-foreground">{entry.changed_by}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-3">
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Alter Stundensatz</p>
                                            <p className="text-lg font-semibold text-muted-foreground">
                                                {entry.old_hourly_rate ? `${entry.old_hourly_rate.toFixed(2)} €` : '-'}
                                            </p>
                                            {entry.old_contract_type && (
                                                <Badge variant="outline" className="text-xs mt-1">
                                                    {entry.old_contract_type}
                                                </Badge>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Neuer Stundensatz</p>
                                            <p className="text-lg font-semibold text-status-ok">
                                                {entry.new_hourly_rate.toFixed(2)} €
                                            </p>
                                            {entry.new_contract_type && (
                                                <Badge variant="outline" className="text-xs mt-1 border-status-ok/70 text-status-ok">
                                                    {entry.new_contract_type}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Änderung in Prozent */}
                                    {entry.old_hourly_rate && (
                                        <div className="mb-3">
                                            {(() => {
                                                const change = ((entry.new_hourly_rate - entry.old_hourly_rate) / entry.old_hourly_rate) * 100;
                                                return (
                                                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                                        change > 0 
                                                            ? 'bg-status-ok/15 text-status-ok' 
                                                            : 'bg-status-danger/15 text-status-danger'
                                                    }`}>
                                                        {change > 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {entry.change_reason && (
                                        <div className="pt-3 border-t border-border">
                                            <p className="text-xs text-muted-foreground mb-1">Grund</p>
                                            <p className="text-sm text-muted-foreground">{entry.change_reason}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Noch keine Änderungen in der Gehaltshistorie</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}