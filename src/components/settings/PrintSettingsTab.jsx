import { useState } from 'react';
import { usePrintSettings, PRINT_AREAS, AREA_MAPPING } from '@/lib/usePrintSettings';
import { toast } from 'sonner';
import { Printer, Check, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const AREA_LABELS = {
    employees:    'Mitarbeiterlisten',
    shifts:       'Dienstpläne',
    recipes:      'Rezepte',
    articles:     'Artikellisten',
    shopping:     'Einkaufsliste',
    todos:        'Aufgabenlisten',
    timetracking: 'Zeiterfassung',
    labels:       'Etiketten',
    receipts:     'Belege',
    accounting:   'Buchhaltung',
    protocol:     'Protokolle',
};

export default function PrintSettingsTab() {
    const { settings, saveMutation, PRINT_AREAS } = usePrintSettings();
    const [local, setLocal] = useState(() => ({ ...settings }));
    const [dirty, setDirty] = useState(false);

    const handleChange = (area, formatKey) => {
        setLocal(prev => ({ ...prev, [area]: formatKey }));
        setDirty(true);
    };

    const handleSave = () => {
        saveMutation.mutate(local, {
            onSuccess: () => { toast.success('Druckeinstellungen gespeichert'); setDirty(false); },
            onError: () => toast.error('Fehler beim Speichern'),
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                        <Printer className="w-4 h-4 text-status-warn" />
                        Druckformat-Einstellungen
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Wähle für jeden Bereich das optimale Papierformat. Die App wendet es automatisch an.
                    </p>
                </div>
                {dirty && (
                    <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}
                        className="bg-status-warn/70 hover:bg-status-warn/70 text-white gap-1.5">
                        <Save className="w-4 h-4" />
                        Speichern
                    </Button>
                )}
            </div>

            {/* Format-Legende */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(PRINT_AREAS).map(([key, { label, icon, description }]) => (
                    <div key={key} className="flex items-start gap-2 p-2.5 rounded-xl border border-border bg-card">
                        <span className="text-lg leading-none">{icon}</span>
                        <div>
                            <p className="text-xs font-semibold text-foreground">{label}</p>
                            <p className="text-[11px] text-muted-foreground">{description}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pro-Bereich Auswahl */}
            <div className="space-y-2">
                <h3 className="text-[12px] font-medium text-muted-foreground">Bereich → Format</h3>
                <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
                    {Object.entries(AREA_LABELS).map(([area, label]) => {
                        const current = local[area] || AREA_MAPPING[area];
                        return (
                            <div key={area} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-secondary/30 transition-colors">
                                <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
                                <div className="flex gap-1.5 flex-wrap justify-end">
                                    {Object.entries(PRINT_AREAS).map(([fKey, { label: fLabel, icon }]) => (
                                        <button
                                            key={fKey}
                                            onClick={() => handleChange(area, fKey)}
                                            title={fLabel}
                                            className={cn(
                                                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-all',
                                                current === fKey
                                                    ? 'bg-status-warn/70 border-status-warn/70 text-white font-semibold'
                                                    : 'border-border text-muted-foreground hover:text-foreground bg-background'
                                            )}>
                                            {icon}
                                            <span className="hidden sm:inline">{fLabel}</span>
                                            {current === fKey && <Check className="w-3 h-3" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
                💡 Tipp: Stelle in deinem Betriebssystem für jeden Drucker den passenden Standard-Papiertyp ein. 
                Dann wählt der Browser beim Drucken automatisch den richtigen Drucker vor.
            </p>
        </div>
    );
}
