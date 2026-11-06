import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    Users, Calendar, Clock, Plane, Package, BookOpen, FlaskConical,
    ClipboardList, Sparkles, CalendarCheck, BarChart2, Settings2,
    Truck, FileText, Layers, Download, Tag, Trash2
} from 'lucide-react';

const MODULES = [
    { id: 'employees', label: 'Mitarbeiter', icon: Users, color: 'bg-primary/70', entities: ['Employee', 'EmployeeDocument'] },
    { id: 'shifts', label: 'Schichten', icon: Calendar, color: 'bg-primary', entities: ['Shift', 'ShiftType', 'ShiftSwapRequest', 'ShiftSwapBid'] },
    { id: 'timetracking', label: 'Zeiterfassung', icon: Clock, color: 'bg-primary', entities: ['TimeEntry', 'ClockEntry'] },
    { id: 'vacation', label: 'Urlaub & Abwesenheit', icon: Plane, color: 'bg-primary', entities: ['VacationRequest'] },
    { id: 'articles', label: 'Artikel & Lager', icon: Package, color: 'bg-status-warn/70', entities: ['Article', 'ArticleCategory', 'StorageItem', 'StorageLocation', 'StorageAssignment'] },
    { id: 'suppliers', label: 'Lieferanten', icon: Truck, color: 'bg-status-warn/70', entities: ['Supplier'] },
    { id: 'recipes', label: 'Rezepte & Kalkulation', icon: FlaskConical, color: 'bg-primary', entities: ['Recipe', 'MenuItem'] },
    { id: 'tasks', label: 'Aufgaben & Checklisten', icon: ClipboardList, color: 'bg-status-ok/70', entities: ['TodoItem', 'TodoCategory', 'RestockItem', 'ShoppingList'] },
    { id: 'cleaning', label: 'Reinigung', icon: Sparkles, color: 'bg-primary', entities: ['CleaningTask', 'CleaningArea', 'CleaningReport'] },
    { id: 'reservations', label: 'Reservierungen', icon: CalendarCheck, color: 'bg-primary', entities: ['Reservation', 'Table', 'Room'] },
    { id: 'inventory', label: 'Inventur & Schwund', icon: BookOpen, color: 'bg-primary', entities: ['InventorySession', 'Wastage'] },
    { id: 'reports', label: 'Reports & Umsätze', icon: BarChart2, color: 'bg-status-warn/70', entities: ['DailyRevenue', 'SalesReport', 'SalesDataItem'] },
    { id: 'documents', label: 'Dokumente', icon: FileText, color: 'bg-surface', entities: ['Document'] },
    { id: 'events', label: 'Events', icon: Tag, color: 'bg-primary', entities: ['Event', 'EventIdea'] },
    { id: 'settings', label: 'Einstellungen & Rollen', icon: Settings2, color: 'bg-surface', entities: ['CompanyInfo', 'NotificationSettings'] },
    { id: 'wastage', label: 'Schwund & Vorlagen', icon: Trash2, color: 'bg-status-danger/70', entities: ['Wastage', 'WastageTemplate'] },
];

export default function ExportModuleSelector({ selected, onChange, onStartExport }) {
    const toggleModule = (id) => {
        if (selected.includes(id)) {
            onChange(selected.filter(s => s !== id));
        } else {
            onChange([...selected, id]);
        }
    };

    const selectAll = () => onChange(MODULES.map(m => m.id));
    const clearAll = () => onChange([]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[13.5px] font-medium text-foreground tracking-tight">Module auswählen</h3>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={selectAll} className="text-xs border-border">Alle</Button>
                    <Button size="sm" variant="outline" onClick={clearAll} className="text-xs border-border">Keine</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MODULES.map(mod => {
                    const isSelected = selected.includes(mod.id);
                    return (
                        <button
                            key={mod.id}
                            onClick={() => toggleModule(mod.id)}
                            className={cn(
                                'text-left p-3 rounded-xl border transition-all',
                                isSelected
                                    ? 'border-primary bg-primary/10'
                                    : 'border-border bg-card hover:bg-accent/30'
                            )}
                        >
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', mod.color)}>
                                <mod.icon className="w-4 h-4 text-white" />
                            </div>
                            <p className="text-xs font-semibold text-foreground leading-tight">{mod.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{mod.entities.length} Entitäten</p>
                        </button>
                    );
                })}
            </div>

            {selected.length > 0 && (
                <Button
                    onClick={onStartExport}
                    className="w-full h-11 bg-primary/70 hover:bg-primary/70 text-white gap-2"
                >
                    <Download className="w-4 h-4" />
                    {selected.length} Module exportieren
                </Button>
            )}
        </div>
    );
}

export { MODULES };