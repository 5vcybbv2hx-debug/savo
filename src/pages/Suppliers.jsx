/**
 * Suppliers — Kontakte & Partner
 * - Deaktivieren statt Löschen
 * - Suche
 * - Kompakte Karten mit primärem Kontakt sichtbar
 * - ··· Menü statt inline Buttons
 * - Modal mit 3 Sektionen (aufklappbar)
 * - Inaktive ausblendbar
 */
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import {
    Plus, UserPlus, Mail, Phone, Globe, MapPin, X, ShoppingCart,
    Building2, Clock, Package, ChevronDown, Star,
    Briefcase, Scale, Shield, Users, MoreVertical,
    Eye, EyeOff, Search, PhoneCall
} from 'lucide-react';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

// ── Typ-Config ────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
    'Lieferant':         { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',    icon: Package,   emoji: '📦' },
    'Steuerberater':     { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',       icon: Briefcase, emoji: '📊' },
    'Anwalt':            { color: 'bg-violet-500/15 text-violet-400 border-violet-500/30', icon: Scale,     emoji: '⚖️' },
    'Versicherung':      { color: 'bg-green-500/15 text-green-400 border-green-500/30',    icon: Shield,    emoji: '🛡️' },
    'Sonstiger Kontakt': { color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',    icon: Users,     emoji: '👤' },
};
const ALL_TYPES = Object.keys(TYPE_CONFIG);

function TypeBadge({ type }) {
    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG['Sonstiger Kontakt'];
    return (
        <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border', cfg.color)}>
            {type || 'Sonstiger Kontakt'}
        </span>
    );
}

// ── Aufklappbare Sektion im Modal ─────────────────────────────────────────────
function ModalSection({ title, defaultOpen = true, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-border/50 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <span className="text-sm font-semibold text-foreground">{title}</span>
                <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="px-4 py-4 space-y-3 bg-background">
                    {children}
                </div>
            )}
        </div>
    );
}

// ── Lieferanten-Karte ─────────────────────────────────────────────────────────
function SupplierCard({ supplier, linkedArticles, onEdit, onToggleActive }) {
    const [articlesOpen, setArticlesOpen] = useState(false);
    const cfg           = TYPE_CONFIG[supplier.type] || TYPE_CONFIG['Sonstiger Kontakt'];
    const isSupplier    = supplier.type === 'Lieferant' || !supplier.type;
    const isInactive    = supplier.is_active === false;
    const primaryContact = supplier.contacts?.find(c => c.name) || null;
    const phone         = primaryContact?.mobile || primaryContact?.phone || supplier.phone || null;

    return (
        <div className={cn(
            'rounded-xl border bg-card overflow-hidden transition-all',
            isInactive ? 'opacity-40 border-border/30' : 'border-border/60 hover:border-border'
        )}>
            {/* Haupt-Zeile */}
            <div className="flex items-start gap-3 p-3.5">
                {/* Emoji-Avatar */}
                <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0 text-lg">
                    {cfg.emoji}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className={cn('text-sm font-bold truncate', isInactive && 'line-through')}>
                            {supplier.name}
                        </p>
                        <TypeBadge type={supplier.type} />
                        {isInactive && (
                            <span className="text-[10px] text-muted-foreground border border-border/50 rounded-full px-1.5 py-0.5">inaktiv</span>
                        )}
                    </div>

                    {/* Adresse */}
                    {(supplier.city || supplier.street) && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                                {[supplier.street, supplier.postal_code, supplier.city].filter(Boolean).join(', ')}
                            </span>
                        </div>
                    )}

                    {/* Primärer Kontakt */}
                    {primaryContact?.name && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <UserPlus className="w-3 h-3 shrink-0" />
                            <span>{primaryContact.name}</span>
                            {primaryContact.role && <span className="opacity-60">· {primaryContact.role}</span>}
                        </div>
                    )}

                    {/* Kontakt-Links */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {phone && (
                            <a href={`tel:${phone}`}
                                className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors">
                                <PhoneCall className="w-3 h-3" />
                                {phone}
                            </a>
                        )}
                        {supplier.email && (
                            <a href={`mailto:${supplier.email}`}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-amber-500 transition-colors truncate max-w-[160px]">
                                <Mail className="w-3 h-3 shrink-0" />
                                {supplier.email}
                            </a>
                        )}
                        {supplier.website && (
                            <a href={supplier.website} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-amber-500 transition-colors">
                                <Globe className="w-3 h-3" />
                                {supplier.website.replace(/^https?:\/\//, '').split('/')[0]}
                            </a>
                        )}
                    </div>

                    {/* Artikel-Link */}
                    {isSupplier && (
                        <div className="mt-2">
                            {linkedArticles.length > 0 ? (
                                <button onClick={() => setArticlesOpen(o => !o)}
                                    className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors">
                                    <Package className="w-3 h-3" />
                                    <span className="font-medium">{linkedArticles.length} Artikel</span>
                                    <ChevronDown className={cn('w-3 h-3 transition-transform', articlesOpen && 'rotate-180')} />
                                </button>
                            ) : (
                                <span className="text-[10px] text-muted-foreground/40">Keine Artikel verknüpft</span>
                            )}
                        </div>
                    )}
                </div>

                {/* ··· Menü */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => onEdit(supplier)}>
                            Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <a href={`/Shopping?supplier=${encodeURIComponent(supplier.name)}`}
                               className="flex items-center gap-2 cursor-pointer">
                                <ShoppingCart className="w-4 h-4" />
                                Einkauf starten
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onToggleActive(supplier)}
                            className={isInactive ? 'text-green-400 focus:text-green-400' : 'text-muted-foreground'}>
                            {isInactive
                                ? <><Eye className="w-4 h-4 mr-2" />Reaktivieren</>
                                : <><EyeOff className="w-4 h-4 mr-2" />Deaktivieren</>
                            }
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Verknüpfte Artikel (aufklappbar) */}
            {articlesOpen && linkedArticles.length > 0 && (
                <div className="border-t border-border/50 px-3.5 py-3 bg-secondary/10">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Verknüpfte Artikel</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {linkedArticles.map(a => {
                            const detail    = (a.supplier_details || []).find(s => s.supplier_name === supplier.name);
                            const isPrimary = detail?.is_primary;
                            const price     = detail?.purchase_price;
                            return (
                                <div key={a.id} className={cn(
                                    'flex items-center gap-2 p-2 rounded-lg border text-xs',
                                    isPrimary ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card'
                                )}>
                                    {a.image_url
                                        ? <img src={a.image_url} alt={a.name} className="w-7 h-7 rounded object-cover shrink-0" />
                                        : <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center shrink-0">
                                            <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                          </div>
                                    }
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-foreground truncate">{a.name}</p>
                                        <p className="text-muted-foreground">
                                            {isPrimary && <span className="text-amber-400 mr-1">★</span>}
                                            {price ? `${parseFloat(price).toFixed(2)} €` : ''}
                                            {detail?.article_number ? ` · ${detail.article_number}` : ''}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function Suppliers() {
    const permissions  = usePermissions();
    const queryClient  = useQueryClient();

    const [modalOpen,        setModalOpen]        = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [activeFilter,     setActiveFilter]     = useState('Alle');
    const [searchTerm,       setSearchTerm]       = useState('');
    const [showInactive,     setShowInactive]     = useState(false);
    const [deactivateTarget, setDeactivateTarget] = useState(null);
    const [saving,           setSaving]           = useState(false);

    const emptyForm = () => ({
        name: '', type: 'Lieferant',
        street: '', postal_code: '', city: '',
        email: '', website: '', phone: '',
        opening_hours: '', notes: '',
        contacts: [], branches: [],
        order: 0, is_active: true,
    });
    const [formData, setFormData] = useState(emptyForm());
    const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: suppliers = [] } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => base44.entities.Supplier.list('order'),
        staleTime: STALE.MEDIUM,
    });
    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list('name', 500),
        staleTime: STALE.SLOW,
    });

    const articlesBySupplier = useMemo(() => {
        const map = {};
        articles.forEach(a => {
            const names = [
                ...(a.supplier_details || []).map(s => s.supplier_name),
                ...(a.suppliers || []),
            ];
            [...new Set(names.filter(Boolean))].forEach(name => {
                if (!map[name]) map[name] = [];
                if (!map[name].find(x => x.id === a.id)) map[name].push(a);
            });
        });
        return map;
    }, [articles]);

    // ── Filter ────────────────────────────────────────────────────────────────
    const typeCounts = useMemo(() => {
        const base = showInactive ? suppliers : suppliers.filter(s => s.is_active !== false);
        const counts = { 'Alle': base.length };
        ALL_TYPES.forEach(t => { counts[t] = base.filter(s => (s.type || 'Sonstiger Kontakt') === t).length; });
        return counts;
    }, [suppliers, showInactive]);

    const filteredSuppliers = useMemo(() => {
        const q = searchTerm.toLowerCase();
        return suppliers.filter(s => {
            if (!showInactive && s.is_active === false) return false;
            if (activeFilter !== 'Alle' && (s.type || 'Sonstiger Kontakt') !== activeFilter) return false;
            if (q) {
                const inName = s.name?.toLowerCase().includes(q);
                const inCity = s.city?.toLowerCase().includes(q);
                const inContact = s.contacts?.some(c => c.name?.toLowerCase().includes(q));
                if (!inName && !inCity && !inContact) return false;
            }
            return true;
        });
    }, [suppliers, activeFilter, searchTerm, showInactive]);

    // ── Mutations ─────────────────────────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.Supplier.create(data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); closeModal(); toast.success('Kontakt erstellt'); },
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Supplier.update(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); closeModal(); },
    });

    // ── Modal ─────────────────────────────────────────────────────────────────
    const openModal = (supplier = null) => {
        if (supplier) {
            setSelectedSupplier(supplier);
            setFormData({
                name:          supplier.name || '',
                type:          supplier.type || 'Lieferant',
                street:        supplier.street || '',
                postal_code:   supplier.postal_code || '',
                city:          supplier.city || '',
                email:         supplier.email || '',
                website:       supplier.website || '',
                phone:         supplier.phone || '',
                opening_hours: supplier.opening_hours || '',
                notes:         supplier.notes || '',
                contacts:      supplier.contacts || [],
                branches:      supplier.branches || [],
                order:         supplier.order || 0,
                is_active:     supplier.is_active ?? true,
            });
        } else {
            setSelectedSupplier(null);
            setFormData({ ...emptyForm(), order: suppliers.length });
        }
        setModalOpen(true);
    };
    const closeModal = () => { setModalOpen(false); setSelectedSupplier(null); setSaving(false); };

    // Weiterblättern (Prev/Next) im Bearbeiten-Modal — folgt exakt der aktuell
    // sichtbaren/gefilterten Liste (filteredSuppliers, bereits nach 'order' sortiert).
    const handleNavigateSupplier = (direction) => {
        if (!selectedSupplier?.id) return;
        const idx = filteredSuppliers.findIndex(s => s.id === selectedSupplier.id);
        if (idx === -1) return;
        const nextIdx = direction === 'next' ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= filteredSuppliers.length) return;
        openModal(filteredSuppliers[nextIdx]);
    };

    const supplierNavPosition = (() => {
        if (!selectedSupplier?.id) return null;
        const idx = filteredSuppliers.findIndex(s => s.id === selectedSupplier.id);
        if (idx === -1) return null;
        return { index: idx, total: filteredSuppliers.length, hasPrev: idx > 0, hasNext: idx < filteredSuppliers.length - 1 };
    })();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (selectedSupplier) updateMutation.mutate({ id: selectedSupplier.id, data: formData });
            else createMutation.mutate(formData);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = (supplier) => {
        if (supplier.is_active === false) {
            updateMutation.mutate({ id: supplier.id, data: { is_active: true } });
            toast.success(`${supplier.name} reaktiviert`);
        } else {
            setDeactivateTarget(supplier);
        }
    };

    const handleDeactivateConfirmed = () => {
        if (!deactivateTarget) return;
        updateMutation.mutate({ id: deactivateTarget.id, data: { is_active: false } });
        toast.success(`${deactivateTarget.name} deaktiviert`);
        setDeactivateTarget(null);
    };

    // ── Contact helpers ───────────────────────────────────────────────────────
    const addContact    = () => setFormData(f => ({ ...f, contacts: [...f.contacts, { name: '', role: '', phone: '', mobile: '', email: '', notes: '' }] }));
    const updateContact = (i, k, v) => setFormData(f => { const c = [...f.contacts]; c[i] = { ...c[i], [k]: v }; return { ...f, contacts: c }; });
    const removeContact = (i) => setFormData(f => ({ ...f, contacts: f.contacts.filter((_, idx) => idx !== i) }));

    // ── Branch helpers ────────────────────────────────────────────────────────
    const addBranch    = () => setFormData(f => ({ ...f, branches: [...f.branches, { name: '', street: '', postal_code: '', city: '', phone: '', email: '', opening_hours: '', notes: '' }] }));
    const updateBranch = (i, k, v) => setFormData(f => { const b = [...f.branches]; b[i] = { ...b[i], [k]: v }; return { ...f, branches: b }; });
    const removeBranch = (i) => setFormData(f => ({ ...f, branches: f.branches.filter((_, idx) => idx !== i) }));

    const filterTabs = ['Alle', ...ALL_TYPES.filter(t => typeCounts[t] > 0)];

    if (!permissions.isManager) return <PermissionDenied message="Nur Manager können Kontakte & Partner verwalten." />;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8">
            <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">

                {/* ── Header ────────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Kontakte & Partner</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {suppliers.filter(s => s.is_active !== false).length} aktiv
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-9 w-9"
                            onClick={() => setShowInactive(s => !s)}
                            title={showInactive ? 'Inaktive ausblenden' : 'Inaktive anzeigen'}>
                            {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                        </Button>
                        <Button size="sm" onClick={() => openModal()}
                            className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                            <Plus className="w-4 h-4" />
                            Neu
                        </Button>
                    </div>
                </div>

                {/* ── Suche ─────────────────────────────────────────────── */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Name, Stadt oder Ansprechpartner…"
                        className="pl-9 h-10"
                    />
                </div>

                {/* ── Typ-Chips ──────────────────────────────────────────── */}
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                    {filterTabs.map(tab => (
                        <button key={tab} onClick={() => setActiveFilter(tab)}
                            className={cn(
                                'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                activeFilter === tab
                                    ? 'bg-amber-500 border-amber-500 text-white'
                                    : 'border-border text-muted-foreground hover:text-foreground bg-card'
                            )}>
                            {tab}
                            {typeCounts[tab] > 0 && (
                                <span className={cn('ml-1.5 text-[10px]', activeFilter === tab ? 'opacity-80' : 'opacity-50')}>
                                    {typeCounts[tab]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Liste ─────────────────────────────────────────────── */}
                {filteredSuppliers.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-4xl mb-3">🏢</p>
                        <p className="font-semibold text-foreground">Keine Einträge</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {searchTerm ? 'Keine Treffer für deine Suche' : 'Füge deinen ersten Kontakt hinzu'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredSuppliers.map(supplier => (
                            <SupplierCard
                                key={supplier.id}
                                supplier={supplier}
                                linkedArticles={articlesBySupplier[supplier.name] || []}
                                onEdit={openModal}
                                onToggleActive={handleToggleActive}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Edit/Create Modal ─────────────────────────────────────── */}
            <Dialog open={modalOpen} onOpenChange={v => !v && closeModal()}>
                <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto p-0">
                    <DialogHeader className="px-5 pt-5 pb-0">
                        <DialogTitle className="text-base flex items-center justify-between gap-2">
                            <span className="truncate">{selectedSupplier ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</span>
                            {supplierNavPosition && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <span className="text-[11px] font-normal text-muted-foreground tabular-nums mr-0.5 hidden sm:inline">
                                        {supplierNavPosition.index + 1} / {supplierNavPosition.total}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleNavigateSupplier('prev')}
                                        disabled={!supplierNavPosition.hasPrev}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                        aria-label="Zurück"
                                    >
                                        ‹
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleNavigateSupplier('next')}
                                        disabled={!supplierNavPosition.hasNext}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors"
                                        aria-label="Weiter"
                                    >
                                        ›
                                    </button>
                                </div>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="px-5 pb-5 pt-4 space-y-3">

                        {/* ── Sektion 1: Basis ──────────────────────────── */}
                        <ModalSection title="🏢 Allgemein" defaultOpen={true}>
                            <div>
                                <Label className="text-xs text-muted-foreground">Name *</Label>
                                <Input required value={formData.name}
                                    onChange={e => set('name', e.target.value)}
                                    placeholder="z.B. Getränke GmbH"
                                    className="h-9 mt-1" />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Typ</Label>
                                <Select value={formData.type} onValueChange={v => set('type', v)}>
                                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ALL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Telefon (allgemein)</Label>
                                <Input value={formData.phone}
                                    onChange={e => set('phone', e.target.value)}
                                    placeholder="+43 1 234 5678"
                                    className="h-9 mt-1" />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">E-Mail</Label>
                                <Input type="email" value={formData.email}
                                    onChange={e => set('email', e.target.value)}
                                    placeholder="info@beispiel.at"
                                    className="h-9 mt-1" />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Webseite</Label>
                                <Input value={formData.website}
                                    onChange={e => set('website', e.target.value)}
                                    placeholder="https://www.beispiel.at"
                                    className="h-9 mt-1" />
                            </div>
                            <div className="flex items-center justify-between pt-1">
                                <Label className="text-xs text-muted-foreground">Aktiv</Label>
                                <Switch checked={formData.is_active}
                                    onCheckedChange={v => set('is_active', v)} />
                            </div>
                        </ModalSection>

                        {/* ── Sektion 2: Adresse & Öffnungszeiten ──────── */}
                        <ModalSection title="📍 Adresse & Zeiten" defaultOpen={false}>
                            <div>
                                <Label className="text-xs text-muted-foreground">Straße & Hausnummer</Label>
                                <Input value={formData.street}
                                    onChange={e => set('street', e.target.value)}
                                    placeholder="Musterstraße 1"
                                    className="h-9 mt-1" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label className="text-xs text-muted-foreground">PLZ</Label>
                                    <Input value={formData.postal_code}
                                        onChange={e => set('postal_code', e.target.value)}
                                        placeholder="1010"
                                        className="h-9 mt-1" />
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Stadt</Label>
                                    <Input value={formData.city}
                                        onChange={e => set('city', e.target.value)}
                                        placeholder="Wien"
                                        className="h-9 mt-1" />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Öffnungszeiten</Label>
                                <Textarea value={formData.opening_hours}
                                    onChange={e => set('opening_hours', e.target.value)}
                                    placeholder={"Mo–Fr: 07:00–18:00\nSa: 08:00–14:00\nSo: geschlossen"}
                                    rows={3}
                                    className="resize-none mt-1 text-sm" />
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Notizen</Label>
                                <Textarea value={formData.notes}
                                    onChange={e => set('notes', e.target.value)}
                                    placeholder="Interne Notizen…"
                                    rows={2}
                                    className="resize-none mt-1 text-sm" />
                            </div>
                        </ModalSection>

                        {/* ── Sektion 3: Ansprechpartner & Filialen ─────── */}
                        <ModalSection title="👥 Ansprechpartner & Filialen" defaultOpen={false}>

                            {/* Ansprechpartner */}
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-muted-foreground">Ansprechpartner</p>
                                <Button type="button" size="sm" variant="outline"
                                    onClick={addContact} className="h-7 px-2 text-xs">
                                    <UserPlus className="w-3 h-3 mr-1" />Hinzufügen
                                </Button>
                            </div>
                            {formData.contacts.length === 0 ? (
                                <p className="text-xs text-muted-foreground/50 text-center py-2">Noch keine Ansprechpartner</p>
                            ) : formData.contacts.map((contact, i) => (
                                <div key={i} className="border border-border/50 rounded-xl p-3 space-y-2 bg-secondary/10">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-foreground">Kontakt {i + 1}</p>
                                        <button type="button" onClick={() => removeContact(i)}
                                            className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground">Name</Label>
                                            <Input value={contact.name} onChange={e => updateContact(i, 'name', e.target.value)}
                                                placeholder="Max Müller" className="h-8 mt-0.5 text-xs" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground">Funktion</Label>
                                            <Input value={contact.role} onChange={e => updateContact(i, 'role', e.target.value)}
                                                placeholder="Verkauf" className="h-8 mt-0.5 text-xs" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground">Telefon</Label>
                                            <Input value={contact.phone} onChange={e => updateContact(i, 'phone', e.target.value)}
                                                placeholder="01 234 5678" className="h-8 mt-0.5 text-xs" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground">Mobil</Label>
                                            <Input value={contact.mobile} onChange={e => updateContact(i, 'mobile', e.target.value)}
                                                placeholder="0699 123 4567" className="h-8 mt-0.5 text-xs" />
                                        </div>
                                        <div className="col-span-2">
                                            <Label className="text-[10px] text-muted-foreground">E-Mail</Label>
                                            <Input type="email" value={contact.email} onChange={e => updateContact(i, 'email', e.target.value)}
                                                placeholder="max@beispiel.at" className="h-8 mt-0.5 text-xs" />
                                        </div>
                                        <div className="col-span-2">
                                            <Label className="text-[10px] text-muted-foreground">Notizen</Label>
                                            <Textarea value={contact.notes} onChange={e => updateContact(i, 'notes', e.target.value)}
                                                placeholder="Weitere Infos…" rows={2} className="resize-none mt-0.5 text-xs" />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Filialen */}
                            <div className="flex items-center justify-between mt-2">
                                <p className="text-xs font-semibold text-muted-foreground">Niederlassungen</p>
                                <Button type="button" size="sm" variant="outline"
                                    onClick={addBranch} className="h-7 px-2 text-xs">
                                    <Building2 className="w-3 h-3 mr-1" />Hinzufügen
                                </Button>
                            </div>
                            {formData.branches.length === 0 ? (
                                <p className="text-xs text-muted-foreground/50 text-center py-2">Noch keine Niederlassungen</p>
                            ) : formData.branches.map((branch, i) => (
                                <div key={i} className="border border-border/50 rounded-xl p-3 space-y-2 bg-secondary/10">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-foreground">Niederlassung {i + 1}</p>
                                        <button type="button" onClick={() => removeBranch(i)}
                                            className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="col-span-2">
                                            <Label className="text-[10px] text-muted-foreground">Name</Label>
                                            <Input value={branch.name} onChange={e => updateBranch(i, 'name', e.target.value)}
                                                placeholder="Filiale Nord" className="h-8 mt-0.5 text-xs" />
                                        </div>
                                        <div className="col-span-2">
                                            <Label className="text-[10px] text-muted-foreground">Straße</Label>
                                            <Input value={branch.street} onChange={e => updateBranch(i, 'street', e.target.value)}
                                                placeholder="Musterstraße 1" className="h-8 mt-0.5 text-xs" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground">PLZ</Label>
                                            <Input value={branch.postal_code} onChange={e => updateBranch(i, 'postal_code', e.target.value)}
                                                placeholder="1010" className="h-8 mt-0.5 text-xs" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground">Stadt</Label>
                                            <Input value={branch.city} onChange={e => updateBranch(i, 'city', e.target.value)}
                                                placeholder="Wien" className="h-8 mt-0.5 text-xs" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground">Telefon</Label>
                                            <Input value={branch.phone} onChange={e => updateBranch(i, 'phone', e.target.value)}
                                                placeholder="01 234 5678" className="h-8 mt-0.5 text-xs" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground">E-Mail</Label>
                                            <Input value={branch.email} onChange={e => updateBranch(i, 'email', e.target.value)}
                                                placeholder="filiale@beispiel.at" className="h-8 mt-0.5 text-xs" />
                                        </div>
                                        <div className="col-span-2">
                                            <Label className="text-[10px] text-muted-foreground">Öffnungszeiten</Label>
                                            <Textarea value={branch.opening_hours} onChange={e => updateBranch(i, 'opening_hours', e.target.value)}
                                                placeholder="Mo–Fr: 08:00–17:00" rows={2} className="resize-none mt-0.5 text-xs" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </ModalSection>

                        {/* Aktionen */}
                        <div className="flex gap-2 pt-1">
                            <Button type="button" variant="outline" onClick={closeModal} className="flex-1 h-10">
                                Abbrechen
                            </Button>
                            <Button type="submit" disabled={saving}
                                className="flex-1 h-10 bg-amber-600 hover:bg-amber-700 text-white">
                                {saving ? 'Speichern…' : 'Speichern'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Deaktivieren-Bestätigung */}
            <AlertDialog open={!!deactivateTarget} onOpenChange={o => !o && setDeactivateTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Kontakt deaktivieren?</AlertDialogTitle>
                        <AlertDialogDescription>
                            „{deactivateTarget?.name}" wird ausgeblendet. Verknüpfte Artikel bleiben erhalten.
                            Du kannst den Kontakt jederzeit reaktivieren.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeactivateConfirmed}
                            className="bg-secondary text-foreground hover:bg-secondary/80">
                            Deaktivieren
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
