import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Search, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const ALL = '__all__';

export default function LabelSlotPicker({
    areas, furniture, slots,
    areaId, furnitureId, onAreaChange, onFurnitureChange,
    selectedIds, onToggle, onSetSelection,
}) {
    const [search, setSearch] = useState('');

    const areaFurniture = useMemo(
        () => furniture.filter(f => !areaId || f.area_id === areaId),
        [furniture, areaId]
    );

    const visibleSlots = useMemo(() => {
        const q = search.trim().toLowerCase();
        return slots.filter(s => {
            if (areaId && s.area_id !== areaId) return false;
            if (furnitureId && s.furniture_id !== furnitureId) return false;
            if (!q) return true;
            return [s.name, s.full_name, s.short_code].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
        });
    }, [slots, areaId, furnitureId, search]);

    const allSelected = visibleSlots.length > 0 && visibleSlots.every(s => selectedIds.includes(s.id));

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <Select
                    value={areaId || ALL}
                    onValueChange={(v) => { onAreaChange(v === ALL ? '' : v); onFurnitureChange(''); }}
                >
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Bereich" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>Alle Bereiche</SelectItem>
                        {areas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select
                    value={furnitureId || ALL}
                    onValueChange={(v) => onFurnitureChange(v === ALL ? '' : v)}
                >
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Möbel" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>Alle Möbel</SelectItem>
                        {areaFurniture.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Fach suchen…"
                    className="h-9 pl-8 text-xs"
                />
            </div>

            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] px-2"
                    onClick={() => onSetSelection(allSelected ? [] : visibleSlots.map(s => s.id))}
                    disabled={visibleSlots.length === 0}
                >
                    {allSelected ? 'Auswahl leeren' : `Alle ${visibleSlots.length} auswählen`}
                </Button>
                <span className="ml-auto text-[11px] text-muted-foreground">
                    {selectedIds.length} gewählt
                </span>
            </div>

            <div className="max-h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border/40">
                {visibleSlots.length === 0 && (
                    <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                        <Layers className="w-3.5 h-3.5" /> Keine Fächer gefunden
                    </div>
                )}
                {visibleSlots.map(slot => {
                    const active = selectedIds.includes(slot.id);
                    return (
                        <button
                            key={slot.id}
                            type="button"
                            onClick={() => onToggle(slot.id)}
                            className={cn(
                                'w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors',
                                active ? 'bg-primary/10' : 'hover:bg-secondary/40'
                            )}
                        >
                            <span className={cn(
                                'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                                active ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                            )}>
                                {active && <Check className="w-3 h-3" />}
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-xs font-medium truncate">{slot.name}</span>
                                <span className="block text-[10px] text-muted-foreground truncate">
                                    {[slot.area_name, slot.furniture_name].filter(Boolean).join(' › ')}
                                </span>
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                {slot.short_code || '—'}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}