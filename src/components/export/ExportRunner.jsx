import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
    Download, CheckCircle2, AlertTriangle, Loader2,
    ArrowLeft, FileJson, Archive, FileText
} from 'lucide-react';

// All entities to export with their labels
const ALL_ENTITIES = [
    { key: 'Employee', label: 'Mitarbeiter', module: 'employees' },
    { key: 'Shift', label: 'Schichten', module: 'shifts' },
    { key: 'ShiftType', label: 'Schichttypen', module: 'shifts' },
    { key: 'ShiftSwapRequest', label: 'Schichttausch-Anfragen', module: 'shifts' },
    { key: 'ShiftSwapBid', label: 'Schichttausch-Gebote', module: 'shifts' },
    { key: 'TimeEntry', label: 'Zeiteinträge', module: 'timetracking' },
    { key: 'ClockEntry', label: 'Stempeluhr-Einträge', module: 'timetracking' },
    { key: 'VacationRequest', label: 'Urlaubsanträge', module: 'vacation' },
    { key: 'UnavailabilityRequest', label: 'Abwesenheitsanfragen', module: 'vacation' },
    { key: 'Article', label: 'Artikel', module: 'articles' },
    { key: 'ArticleCategory', label: 'Artikelkategorien', module: 'articles' },
    { key: 'Supplier', label: 'Lieferanten', module: 'suppliers' },
    { key: 'StorageLocation', label: 'Lagerorte', module: 'articles' },
    { key: 'StorageItem', label: 'Lagerbestand', module: 'articles' },
    { key: 'StorageAssignment', label: 'Lagerzuordnungen', module: 'articles' },
    { key: 'Area', label: 'Bereiche', module: 'articles' },
    { key: 'Furniture', label: 'Möbel', module: 'articles' },
    { key: 'Container', label: 'Behälter', module: 'articles' },
    { key: 'StorageSlot', label: 'Lagerplätze', module: 'articles' },
    { key: 'Recipe', label: 'Rezepte', module: 'recipes' },
    { key: 'MenuItem', label: 'Getränkekarte', module: 'recipes' },
    { key: 'TodoItem', label: 'Aufgaben', module: 'tasks' },
    { key: 'TodoCategory', label: 'Aufgabenkategorien', module: 'tasks' },
    { key: 'RestockItem', label: 'Auffülliste', module: 'tasks' },
    { key: 'ShoppingList', label: 'Einkaufsliste', module: 'tasks' },
    { key: 'CleaningTask', label: 'Reinigungsaufgaben', module: 'cleaning' },
    { key: 'CleaningArea', label: 'Reinigungsbereiche', module: 'cleaning' },
    { key: 'CleaningReport', label: 'Reinigungsberichte', module: 'cleaning' },
    { key: 'Reservation', label: 'Reservierungen', module: 'reservations' },
    { key: 'Table', label: 'Tische', module: 'reservations' },
    { key: 'Room', label: 'Räume', module: 'reservations' },
    { key: 'SeatingLayout', label: 'Sitzplan-Layouts', module: 'reservations' },
    { key: 'InventorySession', label: 'Inventuren', module: 'inventory' },
    { key: 'Wastage', label: 'Schwund', module: 'inventory' },
    { key: 'WastageTemplate', label: 'Schwund-Vorlagen', module: 'inventory' },
    { key: 'DailyRevenue', label: 'Tagesumsätze', module: 'reports' },
    { key: 'SalesReport', label: 'Verkaufsberichte', module: 'reports' },
    { key: 'SalesDataItem', label: 'Verkaufsdaten', module: 'reports' },
    { key: 'Document', label: 'Dokumente', module: 'documents' },
    { key: 'Event', label: 'Events', module: 'events' },
    { key: 'EventIdea', label: 'Event-Ideen', module: 'events' },
    { key: 'CompanyInfo', label: 'Firmendaten', module: 'settings' },
    { key: 'OpeningHours', label: 'Öffnungszeiten', module: 'settings' },
    { key: 'NotificationSettings', label: 'Benachrichtigungseinstellungen', module: 'settings' },
    { key: 'MaintenanceTask', label: 'Wartungsaufgaben', module: 'settings' },
    { key: 'Budget', label: 'Budgets', module: 'reports' },
    { key: 'Expense', label: 'Ausgaben', module: 'reports' },
    { key: 'TipDistribution', label: 'Trinkgeldverteilung', module: 'reports' },
    { key: 'TeamNote', label: 'Teamnotizen', module: 'settings' },
    { key: 'SalaryHistory', label: 'Gehaltshistorie', module: 'employees' },
    { key: 'WorkTimeModel', label: 'Arbeitszeitmodelle', module: 'employees' },
    { key: 'AccessLog', label: 'Zugriffsprotokoll', module: 'settings' },
    { key: 'WeeklySpecial', label: 'Wochenangebote', module: 'recipes' },
    { key: 'WeeklySpecialItem', label: 'Wochenangebot-Positionen', module: 'recipes' },
    { key: 'Stationsplan', label: 'Stationspläne', module: 'shifts' },
    { key: 'StationAssignment', label: 'Stationszuweisungen', module: 'shifts' },
    { key: 'DefaultShiftRule', label: 'Standard-Schichtregeln', module: 'shifts' },
    { key: 'ShiftRequirement', label: 'Schichtanforderungen', module: 'shifts' },
    { key: 'OnboardingTask', label: 'Onboarding-Aufgaben', module: 'employees' },
    { key: 'OnboardingProgress', label: 'Onboarding-Fortschritt', module: 'employees' },
    { key: 'ClosingSession', label: 'Abschlusssitzungen', module: 'tasks' },
    { key: 'Location', label: 'Standorte', module: 'settings' },
    { key: 'PriceHistory', label: 'Preishistorie', module: 'articles' },
];

function generateCSV(data) {
    if (!data || data.length === 0) return '';
    const allKeys = [...new Set(data.flatMap(r => Object.keys(r)))];
    const escape = (v) => {
        if (v == null) return '';
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return `"${s.replace(/"/g, '""')}"`;
    };
    const header = allKeys.join(',');
    const rows = data.map(r => allKeys.map(k => escape(r[k])).join(','));
    return [header, ...rows].join('\n');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export default function ExportRunner({ config, onBack }) {
    const [phase, setPhase] = useState('ready'); // ready | running | done | error
    const [progress, setProgress] = useState([]);
    const [exportData, setExportData] = useState({});
    const [summary, setSummary] = useState(null);
    const cancelRef = useRef(false);

    const entitiesToExport = config.type === 'full'
        ? ALL_ENTITIES
        : config.type === 'module' && config.selectedModules?.length > 0
            ? ALL_ENTITIES.filter(e => config.selectedModules.includes(e.module))
            : ALL_ENTITIES;

    const runExport = async () => {
        cancelRef.current = false;
        setPhase('running');
        setProgress([]);
        const collected = {};
        const log = [];
        let totalRecords = 0;
        let errors = 0;

        for (const ent of entitiesToExport) {
            if (cancelRef.current) break;
            log.push({ key: ent.key, label: ent.label, status: 'loading' });
            setProgress([...log]);

            let records = [];
            let status = 'ok';
            let count = 0;
            let error = null;

            try {
                if (base44.entities[ent.key]) {
                    records = await base44.entities[ent.key].list('-created_date', 5000);
                    count = records.length;
                    totalRecords += count;
                } else {
                    status = 'skipped';
                }
            } catch (e) {
                status = 'error';
                error = e.message;
                errors++;
            }

            collected[ent.key] = records;
            log[log.length - 1] = { key: ent.key, label: ent.label, status, count, error };
            setProgress([...log]);
        }

        setExportData(collected);

        const meta = {
            export_date: new Date().toISOString(),
            app_version: '1.0 (Prototyp)',
            target_platform: 'Bar Shift Pro 2.0',
            format: config.format,
            type: config.type,
            total_records: totalRecords,
            total_entities: entitiesToExport.length,
            errors,
            modules: {},
            export_by: 'admin',
        };

        entitiesToExport.forEach(e => {
            if (!meta.modules[e.module]) meta.modules[e.module] = { entities: {}, total: 0 };
            const count = (collected[e.key] || []).length;
            meta.modules[e.module].entities[e.key] = count;
            meta.modules[e.module].total += count;
        });

        setSummary({ meta, log, totalRecords, errors });
        setPhase('done');

        // Save to export history
        try {
            const historyKey = 'exportHistory';
            const existing = JSON.parse(localStorage.getItem(historyKey) || '[]');
            existing.unshift({
                date: new Date().toISOString(),
                type: config.type,
                format: config.format,
                totalRecords,
                errors,
                modules: Object.keys(meta.modules),
            });
            localStorage.setItem(historyKey, JSON.stringify(existing.slice(0, 20)));
        } catch (e) { /* ignore */ }
    };

    const doDownload = () => {
        if (!summary) return;
        const timestamp = format(new Date(), 'yyyy-MM-dd_HHmm');
        const prefix = `barshift_export_${timestamp}`;

        if (config.format === 'json' || config.format === 'zip') {
            const full = { metadata: summary.meta, data: exportData };
            downloadFile(JSON.stringify(full, null, 2), `${prefix}.json`, 'application/json');

            if (config.format === 'zip') {
                // Also download metadata separately
                downloadFile(JSON.stringify(summary.meta, null, 2), `${prefix}_metadata.json`, 'application/json');
            }
        } else if (config.format === 'csv') {
            // Download each entity as separate CSV
            Object.entries(exportData).forEach(([key, records]) => {
                if (records && records.length > 0) {
                    downloadFile(generateCSV(records), `${prefix}_${key}.csv`, 'text/csv;charset=utf-8;');
                }
            });
        } else if (config.format === 'xlsx') {
            // Fallback to JSON for XLSX (xlsx library needed for real implementation)
            const full = { metadata: summary.meta, data: exportData };
            downloadFile(JSON.stringify(full, null, 2), `${prefix}.json`, 'application/json');
        }
    };

    const totalEntities = entitiesToExport.length;
    const completed = progress.filter(p => p.status !== 'loading').length;
    const progressPct = totalEntities > 0 ? Math.round((completed / totalEntities) * 100) : 0;

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-lg font-bold text-foreground">Export ausführen</h2>
                <Badge className={cn('ml-auto', {
                    'bg-blue-500/20 text-blue-400 border-blue-500/30': phase === 'ready',
                    'bg-amber-500/20 text-amber-400 border-amber-500/30': phase === 'running',
                    'bg-green-500/20 text-green-400 border-green-500/30': phase === 'done',
                    'bg-red-500/20 text-red-400 border-red-500/30': phase === 'error',
                })}>
                    {phase === 'ready' && 'Bereit'}
                    {phase === 'running' && 'Läuft…'}
                    {phase === 'done' && 'Abgeschlossen'}
                    {phase === 'error' && 'Fehler'}
                </Badge>
            </div>

            {/* Config Summary */}
            <Card className="bg-card border-border">
                <CardContent className="p-4 grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-xs text-muted-foreground">Format</p>
                        <p className="text-sm font-bold text-foreground uppercase">{config.format}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Art</p>
                        <p className="text-sm font-bold text-foreground capitalize">{config.type}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Entitäten</p>
                        <p className="text-sm font-bold text-foreground">{totalEntities}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Progress Bar */}
            {phase !== 'ready' && (
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-foreground font-medium">Fortschritt</span>
                            <span className="text-sm text-muted-foreground">{completed}/{totalEntities} · {progressPct}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        {summary && (
                            <div className="flex items-center gap-4 mt-3 text-sm">
                                <span className="text-green-400">✓ {summary.totalRecords.toLocaleString()} Datensätze</span>
                                {summary.errors > 0 && (
                                    <span className="text-red-400">⚠ {summary.errors} Fehler</span>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Entity Log */}
            {progress.length > 0 && (
                <Card className="bg-card border-border">
                    <CardContent className="p-4">
                        <h3 className="text-sm font-semibold text-foreground mb-3">Export-Log</h3>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                            {progress.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                                    {p.status === 'loading' && <Loader2 className="w-3 h-3 text-blue-400 animate-spin shrink-0" />}
                                    {p.status === 'ok' && <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />}
                                    {p.status === 'error' && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                                    {p.status === 'skipped' && <div className="w-3 h-3 rounded-full bg-muted-foreground/30 shrink-0" />}
                                    <span className={cn('flex-1', p.status === 'error' ? 'text-red-300' : 'text-foreground')}>{p.label}</span>
                                    {p.count != null && <span className="text-muted-foreground">{p.count}</span>}
                                    {p.status === 'skipped' && <span className="text-muted-foreground">—</span>}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3">
                {phase === 'ready' && (
                    <Button onClick={runExport} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white gap-2">
                        <Loader2 className="w-4 h-4" />
                        Export starten ({totalEntities} Entitäten)
                    </Button>
                )}
                {phase === 'running' && (
                    <Button
                        onClick={() => { cancelRef.current = true; setPhase('done'); }}
                        variant="outline"
                        className="flex-1 h-11 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                        Abbrechen
                    </Button>
                )}
                {phase === 'done' && (
                    <>
                        <Button onClick={doDownload} className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white gap-2">
                            <Download className="w-4 h-4" />
                            Herunterladen ({config.format.toUpperCase()})
                        </Button>
                        <Button onClick={runExport} variant="outline" className="h-11 border-border text-muted-foreground">
                            Wiederholen
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}