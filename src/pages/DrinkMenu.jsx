import React, { useState, useMemo } from "react";
import { createPageUrl } from '@/utils';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { STALE } from '@/lib/queryUtils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Plus, Wine, Search, Eye, EyeOff, Link2,
    ExternalLink, Copy, Share2, Info, BookOpen,
    MoreVertical, Printer, ChevronDown, AlertTriangle,
    QrCode, Check
} from "lucide-react";
import { ALLERGENS, ADDITIVES } from '../components/menu/AllergenSelector';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import MenuItemModal from "../components/menu/MenuItemModal";
import { usePermissions } from "../components/auth/usePermissions";
import PermissionDenied from "../components/auth/PermissionDenied";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import QRCodeGenerator from "@/components/qr/QRCodeGenerator";
import WeeklySpecialGenerator from "../components/menu/WeeklySpecialGenerator";
import { getGuestMenuLink, copyToClipboard, shareLink, MENU_URL } from '@/lib/guestLinks';
import { cn } from "@/lib/utils";
import { ListSkeleton } from '@/components/ui/StateDisplay';

export default function DrinkMenuPage() {
    const permissions = usePermissions();
    const [showMenuQR, setShowMenuQR] = useState(false);
    const [menuQRCopied, setMenuQRCopied] = useState(false);
    const queryClient = useQueryClient();

    const [selectedItem,    setSelectedItem]    = useState(null);
    const [showModal,       setShowModal]       = useState(false);
    const [searchTerm,      setSearchTerm]      = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [qrCodeOpen,      setQrCodeOpen]      = useState(false);
    const [qrCodeItem,      setQrCodeItem]      = useState(null);
    const [guestLinkCopied, setGuestLinkCopied] = useState(false);
    const [specialsOpen,    setSpecialsOpen]    = useState(false);

    const { data: items = [], isLoading } = useQuery({
        queryKey: ['menu-items'],
        queryFn: () => base44.entities.MenuItem.list('-category', 1000),
        staleTime: STALE.MEDIUM,
    });

    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list('name', 200),
        staleTime: STALE.SLOW,
    });

    const toggleAvailabilityMutation = useMutation({
        mutationFn: ({ id, is_available }) =>
            base44.entities.MenuItem.update(id, { is_available }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu-items'] }),
    });

    if (permissions.isLoading || isLoading) return (
        <div className="min-h-screen bg-background p-4 space-y-4">
            <ListSkeleton count={1} height="h-10" />
            <ListSkeleton count={2} height="h-8" />
            <ListSkeleton count={6} height="h-20" />
        </div>
    );

    if (!permissions.isManager && !permissions.isAdmin) return <PermissionDenied />;

    const canEdit = permissions.isManager || permissions.isAdmin;

    // Kategorien aus den Daten
    const categories = ["all", ...new Set(items.map(i => i.category).filter(Boolean))];

    const filteredItems = items.filter(item =>
        (selectedCategory === "all" || item.category === selectedCategory) &&
        (searchTerm === "" ||
            item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const groupedByCategory = filteredItems.reduce((acc, item) => {
        const cat = item.category || 'Sonstiges';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    const getArticleLowStock = (articleId) => {
        if (!articleId) return false;
        const article = articles.find(a => a.id === articleId);
        return article &&
            article.current_quantity !== undefined &&
            article.min_quantity !== undefined &&
            article.current_quantity < article.min_quantity;
    };

    const openEdit = (item) => { setSelectedItem(item); setShowModal(true); };
    const openNew  = ()     => { setSelectedItem(null); setShowModal(true); };

    // Verwendete Allergene + Zusatzstoffe für Legende
    const usedAllergens = [...new Set(filteredItems.flatMap(i => i.allergens_list || []))];
    const usedAdditives = [...new Set(filteredItems.flatMap(i => i.additives || []))];

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8 print:p-0">
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 print:space-y-2">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between print:hidden">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Getränkekarte</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {items.filter(i => i.is_available !== false).length} verfügbar · {items.length} gesamt
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Gäste-Link — immer sichtbar */}
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 gap-1.5 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                            onClick={() => setShowMenuQR(true)}
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-xs">Gäste-Link</span>
                        </Button>

                        {/* ··· Mehr-Menü */}
                        {canEdit && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9">
                                        <MoreVertical className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                    <DropdownMenuItem onClick={async () => {
                                        await copyToClipboard(getGuestMenuLink());
                                        setGuestLinkCopied(true);
                                        setTimeout(() => setGuestLinkCopied(false), 2000);
                                    }}>
                                        <Copy className="w-4 h-4 mr-2" />
                                        {guestLinkCopied ? 'Kopiert ✓' : 'Link kopieren'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => shareLink(getGuestMenuLink(), 'Getränkekarte')}>
                                        <Share2 className="w-4 h-4 mr-2" />
                                        Link teilen
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => { const s=document.createElement('style'); s.id='__pf__'; s.textContent='@media print{@page{size:A4 portrait;margin:10mm}}'; document.head.appendChild(s); window.print(); setTimeout(()=>{const e=document.getElementById('__pf__');if(e)e.remove();},3000); }}>
                                        <Printer className="w-4 h-4 mr-2" />
                                        Drucken
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <a href="/Recipes" className="flex items-center gap-2 cursor-pointer">
                                            <BookOpen className="w-4 h-4" />
                                            Rezepte
                                        </a>
                                    </DropdownMenuItem>
                                    {permissions.isAdmin && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => setSpecialsOpen(true)}>
                                                <Wine className="w-4 h-4 mr-2" />
                                                Weekly Specials
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {/* Neues Getränk */}
                        {canEdit && (
                            <Button size="sm" onClick={openNew}
                                className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                                <Plus className="w-4 h-4" />
                                <span className="hidden sm:inline">Neu</span>
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── Kategorie-Chips ──────────────────────────────────────── */}
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide print:hidden">
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setSelectedCategory(cat)}
                            className={cn(
                                'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                selectedCategory === cat
                                    ? 'bg-amber-500 border-amber-500 text-white'
                                    : 'border-border text-muted-foreground bg-card hover:text-foreground'
                            )}>
                            {cat === "all" ? "Alle" : cat}
                            {cat !== "all" && (
                                <span className={cn('ml-1.5 text-[10px]',
                                    selectedCategory === cat ? 'opacity-75' : 'opacity-50')}>
                                    {items.filter(i => i.category === cat).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Suche ────────────────────────────────────────────────── */}
                <div className="relative print:hidden">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Getränk suchen…"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-9 h-10"
                    />
                </div>

                {/* ── Empty State ───────────────────────────────────────────── */}
                {filteredItems.length === 0 && (
                    <div className="text-center py-16">
                        <Wine className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                        <p className="font-semibold text-foreground mb-1">
                            {searchTerm ? 'Keine Treffer' : 'Noch keine Getränke'}
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                            {searchTerm
                                ? `Keine Ergebnisse für „${searchTerm}"`
                                : 'Füge dein erstes Getränk hinzu.'}
                        </p>
                        {canEdit && !searchTerm && (
                            <Button size="sm" onClick={openNew}
                                className="bg-amber-600 hover:bg-amber-700 text-white">
                                <Plus className="w-4 h-4 mr-1.5" />Neues Getränk
                            </Button>
                        )}
                    </div>
                )}

                {/* ── Getränke-Liste ────────────────────────────────────────── */}
                {filteredItems.length > 0 && (
                    <div className="space-y-6 print:space-y-3">
                        {Object.entries(groupedByCategory).map(([category, categoryItems]) => (
                            <div key={category}>
                                {/* Kategorie-Header */}
                                <div className="flex items-center gap-3 mb-2.5">
                                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                                        {category}
                                    </h2>
                                    <div className="flex-1 h-px bg-border/50" />
                                    <span className="text-[10px] text-muted-foreground">
                                        {categoryItems.length}
                                    </span>
                                </div>

                                {/* Karten — 1 Spalte Mobile, 2 Spalten Desktop */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 print:grid-cols-2 print:gap-1.5">
                                    {categoryItems
                                        .sort((a, b) => (a.order_position || 999) - (b.order_position || 999))
                                        .map(item => {
                                            const isLowStock = item.linked_article_id
                                                ? getArticleLowStock(item.linked_article_id)
                                                : false;
                                            const isUnavailable = item.is_available === false;

                                            return (
                                                <div key={item.id}
                                                    className={cn(
                                                        'group relative rounded-xl border bg-card p-3.5 transition-all print:page-break-inside-avoid',
                                                        isUnavailable
                                                            ? 'opacity-50 border-border/40'
                                                            : 'border-border/60 hover:border-border cursor-pointer'
                                                    )}
                                                    onClick={() => canEdit && !isUnavailable && openEdit(item)}
                                                >
                                                    {/* Top-Zeile: Name + Preis + Menü */}
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <p className="font-semibold text-sm text-foreground leading-snug flex-1">
                                                            {item.name}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {item.price != null && (
                                                                <span className="text-sm font-bold text-amber-500 whitespace-nowrap">
                                                                    {parseFloat(item.price).toFixed(2)} €
                                                                </span>
                                                            )}
                                                            {canEdit && (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild
                                                                        onClick={e => e.stopPropagation()}>
                                                                        <Button variant="ghost" size="icon"
                                                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                                                                            <MoreVertical className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-44">
                                                                        <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(item); }}>
                                                                            Bearbeiten
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem
                                                                            onClick={e => {
                                                                                e.stopPropagation();
                                                                                toggleAvailabilityMutation.mutate({
                                                                                    id: item.id,
                                                                                    is_available: !item.is_available
                                                                                });
                                                                            }}>
                                                                            {item.is_available !== false ? (
                                                                                <><EyeOff className="w-3.5 h-3.5 mr-2" />Deaktivieren</>
                                                                            ) : (
                                                                                <><Eye className="w-3.5 h-3.5 mr-2" />Aktivieren</>
                                                                            )}
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem onClick={e => {
                                                                            e.stopPropagation();
                                                                            setQrCodeItem(item);
                                                                            setQrCodeOpen(true);
                                                                        }}>
                                                                            QR-Code
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Beschreibung */}
                                                    {item.description && (
                                                        <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2">
                                                            {item.description}
                                                        </p>
                                                    )}

                                                    {/* Badges + Infos */}
                                                    <div className="flex flex-wrap items-center gap-1 mt-1">
                                                        {/* Größe / Volumen */}
                                                        {item.size && (
                                                            <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
                                                                {item.size}
                                                            </span>
                                                        )}

                                                        {/* Status-Badges */}
                                                        {isUnavailable && (
                                                            <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
                                                                nicht verfügbar
                                                            </span>
                                                        )}
                                                        {item.is_seasonal && (
                                                            <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20">
                                                                saisonal
                                                            </span>
                                                        )}
                                                        {item.is_special && (
                                                            <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                                                                special
                                                            </span>
                                                        )}

                                                        {/* Allergene */}
                                                        {(item.allergens_list || []).map((a, i) => (
                                                            <span key={a}
                                                                className="text-[10px] font-mono text-red-400 bg-red-500/8 px-1 py-0.5 rounded border border-red-500/20">
                                                                {String.fromCharCode(65 + usedAllergens.indexOf(a))}
                                                            </span>
                                                        ))}

                                                        {/* Zusatzstoffe */}
                                                        {(item.additives || []).map((d, i) => (
                                                            <span key={d}
                                                                className="text-[10px] font-mono text-blue-400 bg-blue-500/8 px-1 py-0.5 rounded border border-blue-500/20">
                                                                {usedAdditives.indexOf(d) + 1}
                                                            </span>
                                                        ))}

                                                        {/* Low-Stock Warnung */}
                                                        {isLowStock && (
                                                            <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                                                                <AlertTriangle className="w-3 h-3" />
                                                                niedrig
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Allergen-Legende ─────────────────────────────────────── */}
                {(usedAllergens.length > 0 || usedAdditives.length > 0) && (
                    <div className="border border-border/50 rounded-xl p-4 mt-2 print:mt-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Info className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Legende</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {usedAllergens.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-1.5">Allergene</p>
                                    <div className="space-y-0.5">
                                        {usedAllergens.map((a, i) => (
                                            <p key={a} className="text-xs text-muted-foreground">
                                                <span className="text-red-400 font-mono font-bold mr-1.5">
                                                    {String.fromCharCode(65 + i)}
                                                </span>
                                                {a}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {usedAdditives.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-1.5">Zusatzstoffe</p>
                                    <div className="space-y-0.5">
                                        {usedAdditives.map((d, i) => (
                                            <p key={d} className="text-xs text-muted-foreground">
                                                <span className="text-blue-400 font-mono font-bold mr-1.5">{i + 1}</span>
                                                {d}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground/50 mt-3 italic">
                            Alle Angaben ohne Gewähr. Bei Allergien bitte Personal ansprechen.
                        </p>
                    </div>
                )}
            </div>

            {/* ── Modals ───────────────────────────────────────────────────── */}
            {showModal && (
                <MenuItemModal
                    item={selectedItem}
                    open={showModal}
                    onClose={() => { setShowModal(false); setSelectedItem(null); }}
                />
            )}

            {/* QR-Code Modal */}
            <Dialog open={qrCodeOpen} onOpenChange={setQrCodeOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>QR-Code: {qrCodeItem?.name}</DialogTitle>
                    </DialogHeader>
                    {qrCodeItem && (
                        <QRCodeGenerator
                            itemId={qrCodeItem.id}
                            itemName={qrCodeItem.name}
                            type="menuitem"
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Weekly Specials Modal */}
            <Dialog open={specialsOpen} onOpenChange={setSpecialsOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Weekly Specials</DialogTitle>
                    </DialogHeader>
                    <WeeklySpecialGenerator menuItems={items} />
                </DialogContent>
            </Dialog>

            {/* Print Styles */}
            <style>{`
                @media print {
                    body { background: white; }
                    .print\\:hidden { display: none !important; }
                    .print\\:page-break-inside-avoid { page-break-inside: avoid; }
                    .print\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    .print\\:gap-1\\.5 { gap: 0.375rem; }
                    .print\\:space-y-3 > * + * { margin-top: 0.75rem; }
                    .print\\:mt-4 { margin-top: 1rem; }
                    .print\\:p-0 { padding: 0; }
                    .print\\:space-y-2 > * + * { margin-top: 0.5rem; }
                }
            `}</style>

            {/* QR-Code Dialog Getränkekarte */}
            <Dialog open={showMenuQR} onOpenChange={setShowMenuQR}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <QrCode className="w-4 h-4 text-amber-500" />
                            Gäste-Link · Getränkekarte
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 pt-2">
                        <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(MENU_URL)}&bgcolor=ffffff&color=111827&margin=2`}
                                alt="QR-Code"
                                width={220}
                                height={220}
                                className="rounded-lg block"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground text-center leading-relaxed">
                            Gäste scannen diesen Code mit der Kamera-App<br/>
                            und sehen die Getränkekarte sofort im Browser.
                        </p>
                        <div className="w-full flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                            <span className="text-[11px] text-muted-foreground truncate flex-1 font-mono">{MENU_URL}</span>
                            <button
                                onClick={async () => { await copyToClipboard(MENU_URL); setMenuQRCopied(true); setTimeout(() => setMenuQRCopied(false), 2000); }}
                                className="shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                title="Link kopieren"
                            >
                                {menuQRCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <a href={MENU_URL} target="_blank" rel="noopener noreferrer"
                                className="shrink-0 p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                title="Im Browser öffnen">
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}