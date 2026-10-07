import React, { useState, useMemo, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Save, Send, RotateCcw, Users, LayoutGrid, List,
    AlertCircle, X, MapPin, Briefcase, Pencil, Plus,
    Trash2, MoreHorizontal, ChevronDown, Check, Loader2
} from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { toast } from 'sonner';

// ── Fallback-Bereiche (nur für Ersteinrichtung) ───────────────────────────────
const DEFAULT_AREAS = [
    { name: 'Nichtraucher', roles: ['Service', 'Theke', 'Nachschub', 'Spülen', 'Zusatz'],        color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',    badge: 'bg-blue-500/15 text-blue-400',    sort_order: 0 },
    { name: 'Raucher',      roles: ['Service', 'Theke', 'Nachschub', 'Spülen', 'Türe', 'Zusatz'], color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30', badge: 'bg-orange-500/15 text-orange-400', sort_order: 1 },
    { name: 'Tunnel',       roles: ['Service', 'Theke', 'Nachschub', 'Spülen', 'Zusatz'],        color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30', badge: 'bg-purple-500/15 text-purple-400', sort_order: 2 },
];

const AREA_COLORS = [
    { color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',    badge: 'bg-blue-500/15 text-blue-400' },
    { color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30', badge: 'bg-orange-500/15 text-orange-400' },
    { color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30', badge: 'bg-purple-500/15 text-purple-400' },
    { color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30', badge: 'bg-emerald-500/15 text-emerald-400' },
    { color: 'from-red-500/20 to-red-600/10 border-red-500/30',        badge: 'bg-red-500/15 text-red-400' },
    { color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',     badge: 'bg-cyan-500/15 text-cyan-400' },
    { color: 'from-pink-500/20 to-pink-600/10 border-pink-500/30',     badge: 'bg-pink-500/15 text-pink-400' },
];

function slotKey(area, role) { return `${area}||${role}`; }

// ── Employee Chip ─────────────────────────────────────────────────────────────
function EmployeeChip({ name, onRemove, onClick, selected }) {
    return (
        <div
            onClick={onClick}
            className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium select-none transition-all',
                onClick ? 'cursor-pointer active:scale-95' : '',
                selected
                    ? 'bg-primary text-primary-foreground border border-primary'
                    : 'bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30'
            )}
        >
            <div className="w-5 h-5 rounded-full bg-amber-500/40 flex items-center justify-center text-[10px] font-bold text-amber-200 shrink-0">
                {name?.charAt(0)}
            </div>
            <span className="truncate max-w-[80px]">{name?.split(' ')[0]}</span>
            {onRemove && (
                <button
                    onClick={e => { e.stopPropagation(); onRemove(); }}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-0.5"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

// ── Slot (Tap-to-Assign) ──────────────────────────────────────────────────────
function SlotZone({ area, role, assigned, onAssign, onRemove, selectedEmpId }) {
    const isEmpty = assigned.length === 0;
    const isTargetable = !!selectedEmpId && !assigned.find(e => e.id === selectedEmpId);

    return (
        <div
            onClick={() => isTargetable && onAssign(area, role)}
            className={cn(
                'min-h-[42px] rounded-lg border px-2 py-1.5 flex flex-wrap gap-1 items-center transition-all',
                isTargetable
                    ? 'border-primary border-dashed bg-primary/5 cursor-pointer hover:bg-primary/10'
                    : isEmpty
                        ? 'border-dashed border-border/50 bg-background/30'
                        : 'border-border/40 bg-background/20'
            )}
        >
            {assigned.map(emp => (
                <EmployeeChip
                    key={emp.id}
                    name={emp.employee_name}
                    onRemove={() => onRemove(emp.id)}
                />
            ))}
            {isEmpty && (
                <span className={cn('text-[10px] italic pointer-events-none', isTargetable ? 'text-primary/70' : 'text-muted-foreground/40')}>
                    {isTargetable ? '+ Hier zuweisen' : 'leer'}
                </span>
            )}
        </div>
    );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function Stationsplan() {
    const queryClient = useQueryClient();
    const today = format(new Date(), 'yyyy-MM-dd');
    const [selectedDate, setSelectedDate] = useState(today);
    const [selectedShiftId, setSelectedShiftId] = useState('');
    const [view, setView] = useState('bereiche');
    const [planId, setPlanId] = useState(null);
    const [assignments, setAssignments] = useState({});
    const [notes, setNotes] = useState({});
    const [areaNotes, setAreaNotes] = useState({});
    const [editAreasOpen, setEditAreasOpen] = useState(false);
    const [selectedEmpId, setSelectedEmpId] = useState(null);
    const [editAreas, setEditAreas] = useState([]);
    const [newRoleInputs, setNewRoleInputs] = useState({});
    const areaRefs = useRef({});

    // ── Bereiche aus DB laden ─────────────────────────────────────────────────
    const { data: dbAreas = [], isLoading: areasLoading } = useQuery({
        queryKey: ['station-areas'],
        queryFn: async () => {
            const data = await base44.entities.StationArea.filter({ is_active: true }, 'sort_order', 100);
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });

    // Wenn DB leer → Defaults anzeigen (und einmalig seeden)
    const areas = useMemo(() => {
        if (areasLoading) return [];
        if (dbAreas.length > 0) return dbAreas.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        return DEFAULT_AREAS;
    }, [dbAreas, areasLoading]);

    // Einmaliges Seeden wenn noch keine Bereiche in DB
    const seedMutation = useMutation({
        mutationFn: async () => {
            for (let i = 0; i < DEFAULT_AREAS.length; i++) {
                await base44.entities.StationArea.create({ ...DEFAULT_AREAS[i], sort_order: i, is_active: true });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['station-areas'] });
            toast.success('Standard-Bereiche angelegt');
        },
    });

    React.useEffect(() => {
        if (!areasLoading && dbAreas.length === 0) {
            seedMutation.mutate();
        }
    }, [areasLoading, dbAreas.length]);

    // ── Bereiche speichern ────────────────────────────────────────────────────
    const saveAreasMutation = useMutation({
        mutationFn: async (updatedAreas) => {
            for (let i = 0; i < updatedAreas.length; i++) {
                const a = updatedAreas[i];
                if (a.id) {
                    // Update bestehender Bereich
                    await base44.entities.StationArea.update(a.id, {
                        name: a.name,
                        roles: a.roles,
                        color: a.color,
                        badge: a.badge,
                        sort_order: i,
                        is_active: true,
                    });
                } else {
                    // Neuer Bereich
                    const colorIdx = i % AREA_COLORS.length;
                    await base44.entities.StationArea.create({
                        name: a.name,
                        roles: a.roles,
                        color: a.color || AREA_COLORS[colorIdx].color,
                        badge: a.badge || AREA_COLORS[colorIdx].badge,
                        sort_order: i,
                        is_active: true,
                    });
                }
            }
            // Gelöschte Bereiche deaktivieren
            const updatedIds = updatedAreas.filter(a => a.id).map(a => a.id);
            const toDeactivate = dbAreas.filter(a => !updatedIds.includes(a.id));
            for (const a of toDeactivate) {
                await base44.entities.StationArea.update(a.id, { is_active: false });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['station-areas'] });
            setEditAreasOpen(false);
            toast.success('Bereiche gespeichert');
        },
        onError: () => toast.error('Fehler beim Speichern der Bereiche'),
    });

    const openEditAreas = () => {
        setEditAreas(areas.map(a => ({ ...a, roles: [...(a.roles || [])] })));
        setNewRoleInputs({});
        setEditAreasOpen(true);
    };

    // ── Schichten & Pläne ─────────────────────────────────────────────────────
    const { data: shiftsForDay = [] } = useQuery({
        queryKey: ['shifts-for-stationsplan', selectedDate],
        queryFn: () => base44.entities.Shift.filter({ date: selectedDate }),
        enabled: !!selectedDate,
    });

    const shiftOptions = useMemo(() => {
        const seen = new Set();
        return shiftsForDay.filter(s => {
            const key = s.shift_type || s.id;
            if (seen.has(key)) return false;
            seen.add(key); return true;
        });
    }, [shiftsForDay]);

    const employeesInShift = useMemo(() => {
        if (!selectedShiftId) return shiftsForDay;
        const chosen = shiftOptions.find(s => s.id === selectedShiftId);
        if (!chosen) return shiftsForDay;
        return shiftsForDay.filter(s => s.shift_type === chosen.shift_type || s.id === selectedShiftId);
    }, [shiftsForDay, selectedShiftId, shiftOptions]);

    const { data: existingPlans = [] } = useQuery({
        queryKey: ['stationsplan', selectedDate, selectedShiftId],
        queryFn: async () => {
            const plans = await base44.entities.Stationsplan.filter({ date: selectedDate });
            return plans.filter(p => !selectedShiftId || p.shift_id === selectedShiftId || (!p.shift_id && !selectedShiftId));
        },
        enabled: !!selectedDate,
    });

    const { data: existingAssignments = [] } = useQuery({
        queryKey: ['station-assignments', planId],
        queryFn: () => base44.entities.StationAssignment.filter({ stationsplan_id: planId }),
        enabled: !!planId,
    });

    React.useEffect(() => {
        if (existingPlans.length > 0) {
            setPlanId(existingPlans[0].id);
            try { setAreaNotes(JSON.parse(existingPlans[0].area_notes || '{}')); } catch { setAreaNotes({}); }
        } else {
            setPlanId(null);
            setAssignments({});
            setNotes({});
            setAreaNotes({});
        }
    }, [existingPlans]);

    React.useEffect(() => {
        if (existingAssignments.length > 0) {
            const a = {}, n = {};
            existingAssignments.forEach(d => {
                a[d.employee_id] = { area: d.area || '', role: d.role || '', secondary_role: d.secondary_role || '', id: d.id };
                if (d.note) n[d.employee_id] = d.note;
            });
            setAssignments(a);
            setNotes(n);
        }
    }, [existingAssignments]);

    // ── Plan speichern ────────────────────────────────────────────────────────
    const saveMutation = useMutation({
        mutationFn: async (status) => {
            let pid = planId;
            if (!pid) {
                const plan = await base44.entities.Stationsplan.create({
                    date: selectedDate,
                    shift_id: selectedShiftId || null,
                    shift_name: shiftOptions.find(s => s.id === selectedShiftId)?.shift_type || '',
                    status,
                    area_notes: JSON.stringify(areaNotes),
                });
                pid = plan.id;
                setPlanId(pid);
            } else {
                await base44.entities.Stationsplan.update(pid, { status, area_notes: JSON.stringify(areaNotes) });
            }
            for (const emp of employeesInShift) {
                const asgn = assignments[emp.employee_id] || {};
                const existing = existingAssignments.find(a => a.employee_id === emp.employee_id);
                const payload = {
                    stationsplan_id: pid,
                    employee_id: emp.employee_id,
                    employee_name: emp.employee_name,
                    area: asgn.area || '',
                    role: asgn.role || '',
                    secondary_role: asgn.secondary_role || '',
                    note: notes[emp.employee_id] || '',
                };
                if (existing) await base44.entities.StationAssignment.update(existing.id, payload);
                else await base44.entities.StationAssignment.create(payload);
            }
            return pid;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stationsplan', selectedDate, selectedShiftId] });
            queryClient.invalidateQueries({ queryKey: ['station-assignments', planId] });
            toast.success('Stationsplan gespeichert');
        },
    });

    // ── Abgeleiteter State ────────────────────────────────────────────────────
    const slotMap = useMemo(() => {
        const map = {};
        Object.entries(assignments).forEach(([empId, asgn]) => {
            if (asgn.area && asgn.role) {
                const key = slotKey(asgn.area, asgn.role);
                if (!map[key]) map[key] = [];
                map[key].push(empId);
            }
        });
        return map;
    }, [assignments]);

    const unassigned = useMemo(() =>
        employeesInShift.filter(e => {
            const a = assignments[e.employee_id];
            return !a || !a.area || !a.role;
        }),
        [employeesInShift, assignments]
    );

    const getEmpById = (id) => employeesInShift.find(e => e.employee_id === id);

    const hints = useMemo(() => {
        const h = [];
        if (unassigned.length > 0) h.push({ text: `${unassigned.length} Mitarbeiter ohne Zuweisung`, target: null });
        areas.forEach(area => {
            if ((area.roles || []).includes('Theke') && (slotMap[slotKey(area.name, 'Theke')]?.length || 0) === 0)
                h.push({ text: `${area.name}: Theke unbesetzt`, target: area.name });
            if ((area.roles || []).includes('Service') && (slotMap[slotKey(area.name, 'Service')]?.length || 0) === 0)
                h.push({ text: `${area.name}: Service unbesetzt`, target: area.name });
        });
        return h;
    }, [unassigned, slotMap, areas]);

    // ── Tap-to-Assign ─────────────────────────────────────────────────────────
    const handleEmpTap = (empId) => setSelectedEmpId(prev => prev === empId ? null : empId);

    const handleSlotAssign = (area, role) => {
        if (!selectedEmpId) return;
        setAssignments(prev => ({ ...prev, [selectedEmpId]: { ...(prev[selectedEmpId] || {}), area, role } }));
        setSelectedEmpId(null);
    };

    const removeFromSlot = useCallback((empId) => {
        setAssignments(prev => ({ ...prev, [empId]: { ...(prev[empId] || {}), area: '', role: '' } }));
    }, []);

    const handleReset = () => { setAssignments({}); setNotes({}); setSelectedEmpId(null); };

    const scrollToArea = (areaName) => areaRefs.current[areaName]?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const currentPlan = existingPlans[0];

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">

            {/* ── HEADER ───────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
                    <h1 className="text-xl font-bold text-foreground">Stationsplan</h1>
                    {currentPlan && (
                        <Badge className={cn('text-xs shrink-0', currentPlan.status === 'published'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400'
                        )}>
                            {currentPlan.status === 'published' ? '✓ Veröffentlicht' : '● Entwurf'}
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                        variant="outline" size="sm"
                        onClick={() => saveMutation.mutate('draft')}
                        disabled={saveMutation.isPending}
                        className="gap-1.5 min-h-[36px]"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Speichern</span>
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => saveMutation.mutate('published')}
                        disabled={saveMutation.isPending}
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white min-h-[36px]"
                    >
                        <Send className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Veröffentlichen</span>
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="w-9 h-9 min-h-[36px]">
                                <MoreHorizontal className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={openEditAreas}>
                                <Pencil className="w-4 h-4 mr-2" /> Bereiche bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleReset} className="text-destructive focus:text-destructive">
                                <RotateCcw className="w-4 h-4 mr-2" /> Zuweisung zurücksetzen
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* ── KOMPAKTE SELECTOR-LEISTE ──────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="date"
                    value={selectedDate}
                    onChange={e => { setSelectedDate(e.target.value); setSelectedShiftId(''); setAssignments({}); setSelectedEmpId(null); }}
                    className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground min-h-[44px]"
                />
                <Select
                    value={selectedShiftId || '__all__'}
                    onValueChange={(val) => setSelectedShiftId(val === '__all__' ? '' : val)}
                >
                    <SelectTrigger className="h-9 min-h-[44px] flex-1 min-w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">Alle Schichten ({shiftsForDay.length} MA)</SelectItem>
                        {shiftOptions.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.shift_type || 'Schicht'} – {s.start_time}–{s.end_time}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex bg-secondary rounded-xl p-1 gap-0.5 ml-auto">
                    {[['bereiche', <LayoutGrid className="w-3.5 h-3.5" />, 'Bereiche'], ['mitarbeiter', <List className="w-3.5 h-3.5" />, 'Mitarbeiter']].map(([v, icon, label]) => (
                        <button key={v} onClick={() => setView(v)}
                            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all min-h-[36px]',
                                view === v ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {icon}<span className="hidden sm:inline">{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── HINTS ────────────────────────────────────────────────────── */}
            {hints.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {hints.map((hint, i) => (
                        <button key={i}
                            onClick={() => hint.target && scrollToArea(hint.target)}
                            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all',
                                'bg-amber-500/10 border-amber-500/20 text-amber-400',
                                hint.target ? 'hover:bg-amber-500/20 cursor-pointer' : 'cursor-default'
                            )}
                        >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {hint.text}
                            {hint.target && <ChevronDown className="w-3 h-3 opacity-60" />}
                        </button>
                    ))}
                </div>
            )}

            {/* ── LOADING ───────────────────────────────────────────────────── */}
            {areasLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Bereiche werden geladen…
                </div>
            )}

            {/* ── KEIN PERSONAL ────────────────────────────────────────────── */}
            {!areasLoading && employeesInShift.length === 0 ? (
                <Card className="p-12 text-center border-border">
                    <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground text-sm">Keine Schichten für dieses Datum gefunden.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Bitte zuerst Schichten im Kalender einplanen.</p>
                </Card>
            ) : !areasLoading && (
                <>
                    {/* ── POOL ─────────────────────────────────────────────── */}
                    <Card className={cn('p-4 border transition-all', selectedEmpId ? 'border-primary/40 bg-primary/5' : 'border-border bg-card')}>
                        <div className="flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-semibold text-foreground">Heute im Dienst</span>
                            <Badge className={cn('text-xs', unassigned.length === 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400')}>
                                {unassigned.length === 0 ? '✓ Alle eingeteilt' : `${unassigned.length} nicht eingeteilt`}
                            </Badge>
                            {selectedEmpId && (
                                <span className="text-xs text-primary ml-auto animate-pulse">→ Slot antippen</span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {employeesInShift.map(emp => {
                                const asgn = assignments[emp.employee_id];
                                const isAssigned = asgn?.area && asgn?.role;
                                const isSelected = selectedEmpId === emp.employee_id;
                                return (
                                    <div key={emp.employee_id} className="relative">
                                        <EmployeeChip
                                            name={emp.employee_name}
                                            onClick={() => handleEmpTap(emp.employee_id)}
                                            selected={isSelected}
                                        />
                                        {isAssigned && !isSelected && (
                                            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                                                <Check className="w-2 h-2 text-white" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {selectedEmpId && (
                            <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                    <strong className="text-foreground">{getEmpById(selectedEmpId)?.employee_name?.split(' ')[0]}</strong> ausgewählt
                                </span>
                                <button onClick={() => setSelectedEmpId(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                                    <X className="w-3 h-3" /> Abbrechen
                                </button>
                            </div>
                        )}
                    </Card>

                    {/* ── BEREICHE-VIEW ─────────────────────────────────────── */}
                    {view === 'bereiche' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {areas.map(area => (
                                <Card
                                    key={area.id || area.name}
                                    ref={el => areaRefs.current[area.name] = el}
                                    className={cn('p-4 bg-gradient-to-br border', area.color)}
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <Badge className={cn('text-xs font-bold px-2', area.badge)}>{area.name}</Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {(area.roles || []).reduce((acc, r) => acc + (slotMap[slotKey(area.name, r)]?.length || 0), 0)} MA
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {(area.roles || []).map(role => (
                                            <div key={role}>
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Briefcase className="w-3 h-3 text-muted-foreground" />
                                                    <span className="text-xs text-muted-foreground font-medium">{role}</span>
                                                </div>
                                                <SlotZone
                                                    area={area.name}
                                                    role={role}
                                                    assigned={(slotMap[slotKey(area.name, role)] || []).map(id => {
                                                        const e = getEmpById(id);
                                                        return e ? { id, employee_name: e.employee_name } : null;
                                                    }).filter(Boolean)}
                                                    onAssign={handleSlotAssign}
                                                    onRemove={removeFromSlot}
                                                    selectedEmpId={selectedEmpId}
                                                />
                                            </div>
                                        ))}
                                        <textarea
                                            rows={2}
                                            placeholder="Notiz für diesen Bereich…"
                                            value={areaNotes[area.name] || ''}
                                            onChange={e => setAreaNotes(prev => ({ ...prev, [area.name]: e.target.value }))}
                                            className="w-full rounded-lg border border-dashed border-border/40 bg-background/30 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/50 transition-colors mt-1"
                                        />
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* ── MITARBEITER-VIEW ──────────────────────────────────── */}
                    {view === 'mitarbeiter' && (
                        <div className="space-y-2">
                            {employeesInShift.map(emp => {
                                const asgn = assignments[emp.employee_id] || {};
                                const note = notes[emp.employee_id] || '';
                                return (
                                    <Card key={emp.employee_id} className="p-3 sm:p-4 border-border bg-card">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-amber-400 text-sm shrink-0">
                                                    {emp.employee_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-foreground text-sm">{emp.employee_name}</p>
                                                    <p className="text-xs text-muted-foreground">{emp.start_time}–{emp.end_time}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 flex-1">
                                                <Select
                                                    value={asgn.area || '__none__'}
                                                    onValueChange={(val) => setAssignments(prev => ({ ...prev, [emp.employee_id]: { ...(prev[emp.employee_id] || {}), area: val === '__none__' ? '' : val } }))}
                                                >
                                                    <SelectTrigger className="h-9 min-h-[44px] flex-1 min-w-[110px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">Kein Bereich</SelectItem>
                                                        {areas.map(a => <SelectItem key={a.id || a.name} value={a.name}>{a.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <Select
                                                    value={asgn.role || '__none__'}
                                                    onValueChange={(val) => setAssignments(prev => ({ ...prev, [emp.employee_id]: { ...(prev[emp.employee_id] || {}), role: val === '__none__' ? '' : val } }))}
                                                >
                                                    <SelectTrigger className="h-9 min-h-[44px] flex-1 min-w-[100px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">Keine Rolle</SelectItem>
                                                        {(asgn.area
                                                            ? areas.find(a => a.name === asgn.area)?.roles
                                                            : areas.flatMap(a => a.roles || []).filter((v, i, arr) => arr.indexOf(v) === i)
                                                        )?.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <Select
                                                    value={asgn.secondary_role || '__none__'}
                                                    onValueChange={(val) => setAssignments(prev => ({ ...prev, [emp.employee_id]: { ...(prev[emp.employee_id] || {}), secondary_role: val === '__none__' ? '' : val } }))}
                                                >
                                                    <SelectTrigger className="h-9 min-h-[44px] flex-1 min-w-[110px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">Zusatzrolle</SelectItem>
                                                        {['Service', 'Theke', 'Spülen', 'Nachschub', 'Türe'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <input type="text" placeholder="Notiz..."
                                                    value={note}
                                                    onChange={e => setNotes(prev => ({ ...prev, [emp.employee_id]: e.target.value }))}
                                                    className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground flex-1 min-w-[120px] min-h-[44px]"
                                                />
                                            </div>
                                            {(asgn.area || asgn.role) && (
                                                <Badge className="bg-emerald-500/15 text-emerald-400 text-xs shrink-0">
                                                    {[asgn.area, asgn.role].filter(Boolean).join(' / ')}
                                                </Badge>
                                            )}
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ── BEREICHE BEARBEITEN MODAL ─────────────────────────────────── */}
            <Dialog open={editAreasOpen} onOpenChange={setEditAreasOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Bereiche & Rollen bearbeiten</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {editAreas.map((area, areaIdx) => (
                            <Card key={area.id || areaIdx} className="p-4 border-border bg-card space-y-3">
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={area.name}
                                        onChange={e => setEditAreas(prev => prev.map((a, i) => i === areaIdx ? { ...a, name: e.target.value } : a))}
                                        className="font-semibold flex-1"
                                        placeholder="Bereichsname"
                                    />
                                    <Button variant="ghost" size="icon"
                                        onClick={() => setEditAreas(prev => prev.filter((_, i) => i !== areaIdx))}
                                        className="text-destructive hover:bg-destructive/10 shrink-0"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(area.roles || []).map((role, ri) => (
                                        <div key={ri} className="flex items-center gap-1 bg-secondary rounded-lg px-2 py-1">
                                            <Input
                                                value={role}
                                                onChange={e => setEditAreas(prev => prev.map((a, i) => i === areaIdx
                                                    ? { ...a, roles: a.roles.map((r, rj) => rj === ri ? e.target.value : r) }
                                                    : a
                                                ))}
                                                className="h-6 w-20 text-xs border-0 bg-transparent p-0 focus-visible:ring-0"
                                            />
                                            <button
                                                onClick={() => setEditAreas(prev => prev.map((a, i) => i === areaIdx
                                                    ? { ...a, roles: a.roles.filter((_, rj) => rj !== ri) }
                                                    : a
                                                ))}
                                                className="text-muted-foreground hover:text-destructive transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-1">
                                        <Input
                                            value={newRoleInputs[areaIdx] || ''}
                                            onChange={e => setNewRoleInputs(prev => ({ ...prev, [areaIdx]: e.target.value }))}
                                            onKeyDown={e => {
                                                if (e.key !== 'Enter') return;
                                                const val = (newRoleInputs[areaIdx] || '').trim();
                                                if (!val) return;
                                                setEditAreas(prev => prev.map((a, i) => i === areaIdx ? { ...a, roles: [...(a.roles || []), val] } : a));
                                                setNewRoleInputs(prev => ({ ...prev, [areaIdx]: '' }));
                                            }}
                                            placeholder="+ Rolle"
                                            className="h-7 w-24 text-xs"
                                        />
                                        <Button size="icon" variant="ghost" className="w-7 h-7"
                                            onClick={() => {
                                                const val = (newRoleInputs[areaIdx] || '').trim();
                                                if (!val) return;
                                                setEditAreas(prev => prev.map((a, i) => i === areaIdx ? { ...a, roles: [...(a.roles || []), val] } : a));
                                                setNewRoleInputs(prev => ({ ...prev, [areaIdx]: '' }));
                                            }}
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                        <Button variant="outline" className="w-full gap-2"
                            onClick={() => {
                                const idx = editAreas.length % AREA_COLORS.length;
                                setEditAreas(prev => [...prev, { name: 'Neuer Bereich', roles: [], ...AREA_COLORS[idx] }]);
                            }}
                        >
                            <Plus className="w-4 h-4" /> Bereich hinzufügen
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditAreasOpen(false)}>Abbrechen</Button>
                        <Button
                            onClick={() => saveAreasMutation.mutate(editAreas)}
                            disabled={saveAreasMutation.isPending}
                        >
                            {saveAreasMutation.isPending
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Speichern…</>
                                : 'Speichern'
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}