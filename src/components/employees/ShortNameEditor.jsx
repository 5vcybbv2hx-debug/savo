/**
 * ShortNameEditor — Bearbeitung und Historienanzeige des Kurznamens.
 * Nur Manager dürfen den Kurznamen ändern.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tag, Pencil, Check, X, AlertTriangle, History, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { getShortName, suggestShortName, saveShortNameHistory } from '@/lib/shortNameUtils';
import { toast } from 'sonner';

export default function ShortNameEditor({ employee, isManager, currentUser, onUpdate }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(employee?.short_name || '');
    const [note, setNote] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        setValue(employee?.short_name || '');
    }, [employee?.short_name]);

    // Load history
    const { data: history = [] } = useQuery({
        queryKey: ['short-name-history', employee?.id],
        queryFn: () => base44.entities.ShortNameHistory.filter({ employee_id: employee.id }),
        enabled: !!employee?.id && showHistory,
        staleTime: 30000
    });

    // Load all employees for duplicate check
    const { data: allEmployees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
        staleTime: 60000
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            const trimmed = value.trim().toUpperCase();
            // Save history entry
            await saveShortNameHistory(base44, {
                employeeId: employee.id,
                employeeName: employee.name,
                oldShortName: employee.short_name || '',
                newShortName: trimmed,
                changedByEmail: currentUser?.email || '',
                changedByName: currentUser?.full_name || currentUser?.email || 'Manager',
                note
            });
            // Update employee
            await base44.entities.Employee.update(employee.id, { short_name: trimmed });
        },
        onSuccess: () => {
            toast.success('Kurzname gespeichert');
            setEditing(false);
            setNote('');
            queryClient.invalidateQueries({ queryKey: ['employee', employee.id] });
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            queryClient.invalidateQueries({ queryKey: ['short-name-history', employee.id] });
            if (onUpdate) onUpdate();
        },
        onError: (e) => toast.error('Fehler: ' + e.message)
    });

    const currentShortName = getShortName(employee);
    const suggestion = suggestShortName(employee?.name);
    const trimmedValue = value.trim().toUpperCase();

    // Duplicate check (excluding current employee)
    const duplicate = trimmedValue && allEmployees.find(e =>
        e.id !== employee?.id &&
        e.short_name?.trim().toUpperCase() === trimmedValue
    );

    const sortedHistory = [...history].sort((a, b) =>
        (b.change_date + 'T' + b.change_time).localeCompare(a.change_date + 'T' + a.change_time)
    );

    return (
        <Card className="border-border">
            <CardContent className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-status-warn shrink-0" />
                    <h3 className="text-sm font-bold text-foreground">Kurzname / Kürzel</h3>
                    {!isManager && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border ml-auto">
                            nur Ansicht
                        </Badge>
                    )}
                </div>

                {/* Display / Edit */}
                {!editing ? (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1">
                            {/* Badge-Anzeige */}
                            <span className="inline-flex items-center justify-center min-w-[48px] h-10 px-3 rounded-xl bg-status-warn/15 border border-status-warn/30 text-status-warn font-bold text-base tracking-wide">
                                {currentShortName}
                            </span>
                            {!employee?.short_name && (
                                <span className="text-xs text-muted-foreground italic">(auto-generiert)</span>
                            )}
                        </div>
                        {isManager && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditing(true)}
                                className="h-10 gap-1.5 text-xs"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                                Ändern
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Input */}
                        <div className="space-y-1.5">
                            <input
                                type="text"
                                value={value}
                                onChange={e => setValue(e.target.value.toUpperCase().substring(0, 6))}
                                placeholder={suggestion}
                                maxLength={6}
                                className="w-full h-11 px-3 rounded-xl border border-input bg-transparent text-foreground text-base font-bold tracking-widest focus:outline-none focus:ring-1 focus:ring-ring uppercase"
                                autoFocus
                            />
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] text-muted-foreground">max. 6 Zeichen · wird automatisch großgeschrieben</p>
                                {value.trim() === '' && (
                                    <button
                                        type="button"
                                        onClick={() => setValue(suggestion)}
                                        className="flex items-center gap-1 text-[10px] text-status-warn hover:text-status-warn/25"
                                    >
                                        <Lightbulb className="w-3 h-3" />
                                        Vorschlag: {suggestion}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Duplicate warning */}
                        {duplicate && (
                            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-status-warn/10 border border-status-warn/30">
                                <AlertTriangle className="w-3.5 h-3.5 text-status-warn shrink-0 mt-0.5" />
                                <p className="text-xs text-status-warn/25">
                                    Kürzel bereits verwendet von: <strong>{duplicate.name}</strong>. Doppelungen möglich, werden nicht gesperrt.
                                </p>
                            </div>
                        )}

                        {/* Optional note */}
                        <input
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Grund / Notiz (optional)"
                            className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />

                        {/* Actions */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setEditing(false); setValue(employee?.short_name || ''); setNote(''); }}
                                className="flex-1 h-10"
                            >
                                <X className="w-3.5 h-3.5 mr-1" />Abbrechen
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => saveMutation.mutate()}
                                disabled={saveMutation.isPending || !value.trim()}
                                className="flex-1 h-10 bg-status-warn/70 hover:bg-status-warn/70 text-white"
                            >
                                <Check className="w-3.5 h-3.5 mr-1" />Speichern
                            </Button>
                        </div>
                    </div>
                )}

                {/* History toggle */}
                <button
                    onClick={() => setShowHistory(v => !v)}
                    className="w-full flex items-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <History className="w-3.5 h-3.5" />
                    Änderungsverlauf
                    {showHistory ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
                </button>

                {/* History list */}
                {showHistory && (
                    <div className="space-y-2 pt-1">
                        {sortedHistory.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-3">Keine Änderungen gespeichert</p>
                        ) : (
                            sortedHistory.map((entry, idx) => (
                                <div key={idx} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-secondary/40">
                                    <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
                                        <span className="text-xs font-bold text-muted-foreground">{entry.old_short_name || '—'}</span>
                                        <span className="text-[9px] text-muted-foreground">→</span>
                                        <span className="text-xs font-bold text-foreground">{entry.new_short_name}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-foreground">
                                            {entry.weekday}, {entry.change_date ? format(parseISO(entry.change_date), 'dd.MM.yyyy', { locale: de }) : ''} · {entry.change_time}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">von {entry.changed_by_name || entry.changed_by_email}</p>
                                        {entry.note && <p className="text-[10px] text-muted-foreground italic mt-0.5">„{entry.note}"</p>}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}