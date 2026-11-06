import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Shield, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

const CHECKS = [
    {
        id: 'employees_active',
        label: 'Aktive Mitarbeiter ohne Name',
        run: async () => {
            const data = await base44.entities.Employee.filter({ is_active: true });
            const bad = data.filter(e => !e.name);
            return { ok: bad.length === 0, count: data.length, issues: bad.length, details: bad.map(e => e.id) };
        }
    },
    {
        id: 'shifts_orphaned',
        label: 'Schichten ohne Mitarbeiter-ID',
        run: async () => {
            const data = await base44.entities.Shift.list('-date', 2000);
            const bad = data.filter(s => !s.employee_id);
            return { ok: bad.length === 0, count: data.length, issues: bad.length };
        }
    },
    {
        id: 'timeentries_missing_hours',
        label: 'Zeiteinträge ohne Stunden-Wert',
        run: async () => {
            const data = await base44.entities.TimeEntry.list('-date', 2000);
            const bad = data.filter(e => e.total_hours == null || e.total_hours < 0);
            return { ok: bad.length === 0, count: data.length, issues: bad.length };
        }
    },
    {
        id: 'clock_entries_no_clockin',
        label: 'ClockEntries ohne Einstempelzeit',
        run: async () => {
            const data = await base44.entities.ClockEntry.list('-clock_in', 2000);
            const bad = data.filter(e => !e.clock_in);
            return { ok: bad.length === 0, count: data.length, issues: bad.length };
        }
    },
    {
        id: 'articles_missing_name',
        label: 'Artikel ohne Name',
        run: async () => {
            const data = await base44.entities.Article.list('-created_date', 2000);
            const bad = data.filter(a => !a.name);
            return { ok: bad.length === 0, count: data.length, issues: bad.length };
        }
    },
    {
        id: 'reservations_missing_date',
        label: 'Reservierungen ohne Datum',
        run: async () => {
            const data = await base44.entities.Reservation.list('-date', 2000);
            const bad = data.filter(r => !r.date);
            return { ok: bad.length === 0, count: data.length, issues: bad.length };
        }
    },
    {
        id: 'todos_missing_title',
        label: 'Aufgaben ohne Titel',
        run: async () => {
            const data = await base44.entities.TodoItem.list('-created_date', 2000);
            const bad = data.filter(t => !t.title);
            return { ok: bad.length === 0, count: data.length, issues: bad.length };
        }
    },
    {
        id: 'vacation_orphaned',
        label: 'Urlaubsanträge ohne Mitarbeiter-ID',
        run: async () => {
            const data = await base44.entities.VacationRequest.list('-created_date', 1000);
            const bad = data.filter(v => !v.employee_id);
            return { ok: bad.length === 0, count: data.length, issues: bad.length };
        }
    },
];

export default function ExportValidation() {
    const [results, setResults] = useState([]);
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(false);

    const runValidation = async () => {
        setRunning(true);
        setDone(false);
        setResults([]);
        const log = [];

        for (const check of CHECKS) {
            log.push({ id: check.id, label: check.label, status: 'running' });
            setResults([...log]);
            try {
                const result = await check.run();
                log[log.length - 1] = {
                    id: check.id,
                    label: check.label,
                    status: result.ok ? 'ok' : 'warn',
                    count: result.count,
                    issues: result.issues,
                };
            } catch (e) {
                log[log.length - 1] = {
                    id: check.id,
                    label: check.label,
                    status: 'error',
                    error: e.message,
                };
            }
            setResults([...log]);
        }

        setRunning(false);
        setDone(true);
    };

    const okCount = results.filter(r => r.status === 'ok').length;
    const warnCount = results.filter(r => r.status === 'warn').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">Datenvalidierung</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Prüft Datenkonsistenz vor dem Export</p>
                </div>
                <Button
                    onClick={runValidation}
                    disabled={running}
                    className="bg-primary/70 hover:bg-primary/70 text-white gap-2 text-sm"
                >
                    {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {running ? 'Prüfe…' : 'Validierung starten'}
                </Button>
            </div>

            {done && (
                <Card className={cn('border', warnCount + errorCount === 0 ? 'border-status-ok/30 bg-status-ok/5' : 'border-status-warn/30 bg-status-warn/5')}>
                    <CardContent className="p-4 flex items-center gap-4">
                        {warnCount + errorCount === 0
                            ? <CheckCircle2 className="w-6 h-6 text-status-ok" />
                            : <AlertTriangle className="w-6 h-6 text-status-warn" />
                        }
                        <div>
                            <p className="font-semibold text-foreground text-sm">
                                {warnCount + errorCount === 0 ? 'Alle Prüfungen bestanden' : `${warnCount + errorCount} Probleme gefunden`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                ✓ {okCount} OK · ⚠ {warnCount} Warnung{warnCount !== 1 ? 'en' : ''} · ✕ {errorCount} Fehler
                            </p>
                        </div>
                        <p className="ml-auto text-xs text-muted-foreground">Export trotzdem möglich</p>
                    </CardContent>
                </Card>
            )}

            {results.length > 0 && (
                <Card className="bg-card border-border">
                    <CardContent className="p-4 space-y-2">
                        {results.map((r, i) => (
                            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                                {r.status === 'running' && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}
                                {r.status === 'ok' && <CheckCircle2 className="w-4 h-4 text-status-ok shrink-0" />}
                                {r.status === 'warn' && <AlertTriangle className="w-4 h-4 text-status-warn shrink-0" />}
                                {r.status === 'error' && <XCircle className="w-4 h-4 text-status-danger shrink-0" />}
                                <span className="text-sm text-foreground flex-1">{r.label}</span>
                                {r.count != null && <span className="text-xs text-muted-foreground">{r.count} Einträge</span>}
                                {r.issues > 0 && (
                                    <Badge className="text-[10px] bg-status-warn/20 text-status-warn border-status-warn/30">
                                        {r.issues} Problem{r.issues !== 1 ? 'e' : ''}
                                    </Badge>
                                )}
                                {r.status === 'ok' && (
                                    <Badge className="text-[10px] bg-status-ok/20 text-status-ok border-status-ok/30">OK</Badge>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {results.length === 0 && !running && (
                <Card className="bg-card border-border">
                    <CardContent className="p-8 text-center text-muted-foreground">
                        <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Validierung noch nicht gestartet</p>
                        <p className="text-xs mt-1">Prüft {CHECKS.length} Datenkonsistenz-Regeln</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}