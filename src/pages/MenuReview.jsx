import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { STALE } from '@/lib/queryUtils';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Check, Pencil, EyeOff, Trash2, SkipForward, X, PartyPopper, TrendingUp, ClipboardList,
} from "lucide-react";
import { usePermissions } from "../components/auth/usePermissions";
import PermissionDenied from "../components/auth/PermissionDenied";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getEffectivePurchasePrice, roundPrice, foodCostRating } from "@/lib/recipeCosting";
import { ListSkeleton } from '@/components/ui/StateDisplay';

/**
 * Karten-Review-Modus — "Karte neu drucken"-Simulation: geht jedes verfügbare Getränk
 * einzeln durch (Fokus-Modus, gleiches Prinzip wie RundgangMode.jsx), man entscheidet pro
 * Getränk: behalten, Preis anpassen, deaktivieren (reversibel) oder löschen (endgültig).
 * Reihenfolge: nie geprüfte Getränke zuerst, dann am längsten nicht geprüfte — so deckt ein
 * erster Durchlauf automatisch ALLES ab, und jeder spätere Durchlauf zeigt zuerst das Älteste.
 */
export default function MenuReview() {
    const permissions = usePermissions();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [sessionLog, setSessionLog] = useState([]); // [{name, action}]
    const [editingPrice, setEditingPrice] = useState(false);
    const [priceInput, setPriceInput] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [skippedIds, setSkippedIds] = useState([]); // in dieser Session zurückgestellt

    const { data: items = [], isLoading } = useQuery({
        queryKey: ['menu-items'],
        queryFn: () => base44.entities.MenuItem.list('-category', 1000),
        staleTime: STALE.FAST,
    });
    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list('name', 2000),
        staleTime: STALE.SLOW,
    });
    const { data: recipes = [] } = useQuery({
        queryKey: ['recipes'],
        queryFn: () => base44.entities.Recipe.list('name'),
        staleTime: STALE.SLOW,
    });

    // ── Warteschlange: aktive Getränke, älteste/nie geprüfte zuerst, zurückgestellte ans Ende
    const queue = useMemo(() => {
        const active = items.filter(i => i.is_available !== false);
        const sorted = [...active].sort((a, b) => {
            const da = a.last_reviewed_date ? new Date(a.last_reviewed_date).getTime() : 0;
            const db = b.last_reviewed_date ? new Date(b.last_reviewed_date).getTime() : 0;
            if (da !== db) return da - db; // 0 (nie geprüft) kommt zuerst
            return (a.category || '').localeCompare(b.category || '') || (a.order_position || 999) - (b.order_position || 999);
        });
        const [skipped, rest] = [
            sorted.filter(i => skippedIds.includes(i.id)),
            sorted.filter(i => !skippedIds.includes(i.id)),
        ];
        return [...rest, ...skipped];
    }, [items, skippedIds]);

    const totalCount = items.filter(i => i.is_available !== false).length;
    const remaining = queue.length;
    const doneCount = totalCount - remaining;
    const current = queue[0] || null;

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.MenuItem.update(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu-items'] }),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.MenuItem.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu-items'] }),
    });

    if (permissions.isLoading || isLoading) {
        return (
            <div className="min-h-screen bg-background p-4 space-y-4 max-w-lg mx-auto">
                <ListSkeleton count={1} height="h-10" />
                <ListSkeleton count={3} height="h-32" />
            </div>
        );
    }
    if (!permissions.isManager && !permissions.isAdmin) {
        return <PermissionDenied message="Nur Manager/Admins können die Karte reviewen." />;
    }

    const logAction = (name, action) => setSessionLog(prev => [...prev, { name, action }]);

    const resetEditState = () => { setEditingPrice(false); setPriceInput(""); };

    const handleBehalten = () => {
        if (!current) return;
        updateMutation.mutate({ id: current.id, data: { last_reviewed_date: new Date().toISOString() } });
        logAction(current.name, 'behalten');
        resetEditState();
    };

    const handleDeaktivieren = () => {
        if (!current) return;
        updateMutation.mutate({ id: current.id, data: { is_available: false, last_reviewed_date: new Date().toISOString() } });
        logAction(current.name, 'deaktiviert');
        resetEditState();
        toast.success(`„${current.name}" deaktiviert — jederzeit reversibel in der Getränkekarte`);
    };

    const handleLoeschenConfirm = () => {
        if (!deleteTarget) return;
        deleteMutation.mutate(deleteTarget.id);
        logAction(deleteTarget.name, 'gelöscht');
        setDeleteTarget(null);
        resetEditState();
        toast.success(`„${deleteTarget.name}" endgültig gelöscht`);
    };

    const handleSkip = () => {
        if (!current) return;
        setSkippedIds(prev => [...prev, current.id]);
        resetEditState();
    };

    const handleSavePrice = () => {
        if (!current) return;
        const parsed = parseFloat(priceInput.replace(',', '.'));
        if (isNaN(parsed) || parsed <= 0) { toast.error('Bitte einen gültigen Preis eingeben.'); return; }
        updateMutation.mutate({ id: current.id, data: { price: parsed, last_reviewed_date: new Date().toISOString() } });
        logAction(current.name, `Preis → ${parsed.toFixed(2)} €`);
        resetEditState();
    };

    // ── Session-Ende ────────────────────────────────────────────────────────
    if (!current) {
        const counts = sessionLog.reduce((acc, l) => {
            const key = l.action.startsWith('Preis') ? 'preis' : l.action;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        return (
            <div className="min-h-screen bg-background p-4 max-w-lg mx-auto flex flex-col items-center justify-center text-center gap-4">
                <PartyPopper className="w-12 h-12 text-primary" />
                <h1 className="text-xl font-bold text-foreground">Review abgeschlossen</h1>
                {sessionLog.length > 0 ? (
                    <div className="w-full space-y-1.5 text-sm">
                        {counts.behalten   && <p className="text-muted-foreground">{counts.behalten} behalten</p>}
                        {counts.preis      && <p className="text-muted-foreground">{counts.preis} Preis angepasst</p>}
                        {counts.deaktiviert&& <p className="text-muted-foreground">{counts.deaktiviert} deaktiviert</p>}
                        {counts.gelöscht   && <p className="text-muted-foreground">{counts.gelöscht} gelöscht</p>}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Aktuell gibt es nichts zu prüfen — alle Getränke sind aktuell geprüft.</p>
                )}
                <Button className="w-full mt-2" onClick={() => navigate(createPageUrl('DrinkMenu'))}>
                    Zur Getränkekarte
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate(createPageUrl('KarteHub'))}>
                    Zurück zur Übersicht
                </Button>
            </div>
        );
    }

    // ── Live-Kalkulation fürs aktuelle Getränk ─────────────────────────────
    // Beim Preis-Anpassen wird live mit dem gerade getippten Wert gerechnet (Schnellkalkulation),
    // sonst mit dem aktuell gespeicherten Verkaufspreis.
    const effectivePurchasePrice = getEffectivePurchasePrice(current, { articles, recipes });
    const currentSellPrice = current.price;
    const parsedPriceInput = parseFloat(priceInput.replace(',', '.'));
    const previewSellPrice = editingPrice && !isNaN(parsedPriceInput) && parsedPriceInput > 0
        ? parsedPriceInput
        : currentSellPrice;
    const foodCostPct = (effectivePurchasePrice != null && currentSellPrice > 0)
        ? (effectivePurchasePrice / currentSellPrice) * 100 : null;
    const previewFoodCostPct = (effectivePurchasePrice != null && previewSellPrice > 0)
        ? (effectivePurchasePrice / previewSellPrice) * 100 : null;
    const previewMarginAbsolute = (effectivePurchasePrice != null && previewSellPrice != null)
        ? previewSellPrice - effectivePurchasePrice : null;
    const rating = foodCostRating(foodCostPct);
    const previewRating = foodCostRating(previewFoodCostPct);

    const lastReviewedLabel = current.last_reviewed_date
        ? `zuletzt geprüft vor ${formatDistanceToNow(new Date(current.last_reviewed_date), { locale: de })}`
        : 'noch nie geprüft';

    const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    return (
        <div className="min-h-screen bg-background pb-8">
            <div className="max-w-lg mx-auto px-4 py-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h1 className="text-lg font-bold text-foreground">Karten-Review</h1>
                        <p className="text-xs text-muted-foreground">Karte durchgehen wie beim Neudruck</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('KarteHub'))}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Sticky Fortschritt */}
                <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur-sm flex items-center gap-3 mb-3">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground shrink-0">
                        {doneCount}/{totalCount} geprüft
                    </p>
                </div>

                {/* Karte */}
                <Card className="p-5 space-y-4">
                    <div>
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            <Badge variant="secondary" className="text-[10px]">{current.category || 'Sonstiges'}</Badge>
                            {current.subcategory && <Badge variant="outline" className="text-[10px]">{current.subcategory}</Badge>}
                        </div>
                        <h2 className="text-xl font-bold text-foreground">{current.name}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{lastReviewedLabel}</p>
                    </div>

                    {!editingPrice ? (
                        <div className="flex items-baseline justify-between">
                            <span className="text-3xl font-bold text-foreground">{Number(current.price || 0).toFixed(2)} €</span>
                            {current.size && <span className="text-sm text-muted-foreground">{current.size}</span>}
                        </div>
    ) : (
                        <div className="space-y-2.5">
                            <Input
                                type="number" step="0.10" autoFocus
                                className="h-12 text-lg font-semibold"
                                value={priceInput}
                                onChange={e => setPriceInput(e.target.value)}
                                placeholder={String(current.price)}
                            />

                            {/* Schnellkalkulation — Live-EK, Marge & Wareneinsatz für den gerade
                                getippten Preis, gleiche Logik/Darstellung wie im Getränke-Modal */}
                            {effectivePurchasePrice != null && effectivePurchasePrice > 0 && (
                                <div className={cn(
                                    "rounded-xl border p-3 space-y-2",
                                    previewRating === 'bad'  && "bg-destructive/10 border-destructive/30",
                                    previewRating === 'ok'   && "bg-amber-500/10 border-amber-500/30",
                                    previewRating === 'good' && "bg-emerald-500/10 border-emerald-500/30",
                                    previewRating == null    && "bg-muted/40 border-border/60"
                                )}>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Einkaufspreis</span>
                                        <span className="font-semibold text-foreground">{effectivePurchasePrice.toFixed(2)} €</span>
                                    </div>
                                    {previewFoodCostPct != null ? (
                                        <>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Marge</span>
                                                <span className="font-semibold text-foreground">{previewMarginAbsolute.toFixed(2)} €</span>
                                            </div>
                                            <div className="flex items-center justify-between pt-1 border-t border-border/40">
                                                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                                    <TrendingUp className="w-3.5 h-3.5" />Wareneinsatz
                                                </span>
                                                <span className={cn(
                                                    "text-base font-bold",
                                                    previewRating === 'bad'  && "text-destructive",
                                                    previewRating === 'ok'   && "text-amber-500",
                                                    previewRating === 'good' && "text-emerald-600 dark:text-emerald-400"
                                                )}>
                                                    {previewFoodCostPct.toFixed(1)}%
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">Preis eingeben, um Marge & Wareneinsatz zu sehen.</p>
                                    )}

                                    <div className="grid grid-cols-3 gap-2 pt-1">
                                        {[{ label: 'Günstig', pct: 35 }, { label: 'Standard', pct: 28 }, { label: 'Premium', pct: 20 }].map(s => {
                                            const suggested = roundPrice(effectivePurchasePrice / (s.pct / 100));
                                            return (
                                                <button
                                                    key={s.label} type="button"
                                                    onClick={() => suggested != null && setPriceInput(String(suggested))}
                                                    className="rounded-lg border border-border/60 bg-background/70 hover:bg-background hover:border-border px-2 py-2 text-center transition-colors"
                                                >
                                                    <p className="text-[10px] font-semibold text-muted-foreground">{s.label} · {s.pct}%</p>
                                                    <p className="text-xs font-bold text-foreground">{suggested != null ? suggested.toFixed(2) : '—'} €</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground text-center pt-0.5">Vorschlag antippen übernimmt den Preis oben</p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={resetEditState}>Abbrechen</Button>
                                <Button className="flex-1" onClick={handleSavePrice} disabled={updateMutation.isPending}>Speichern</Button>
                            </div>
                        </div>
                    )}

                    {!editingPrice && effectivePurchasePrice != null && effectivePurchasePrice > 0 && (
                        <div className={cn(
                            "rounded-xl border p-3 flex items-center justify-between",
                            rating === 'bad'  && "bg-destructive/10 border-destructive/30",
                            rating === 'ok'   && "bg-amber-500/10 border-amber-500/30",
                            rating === 'good' && "bg-emerald-500/10 border-emerald-500/30",
                            rating == null    && "bg-muted/40 border-border/60"
                        )}>
                            <span className="text-xs text-muted-foreground">EK {effectivePurchasePrice.toFixed(2)} €</span>
                            {foodCostPct != null && (
                                <span className={cn(
                                    "text-sm font-bold flex items-center gap-1",
                                    rating === 'bad'  && "text-destructive",
                                    rating === 'ok'   && "text-amber-500",
                                    rating === 'good' && "text-emerald-600 dark:text-emerald-400"
                                )}>
                                    <TrendingUp className="w-3.5 h-3.5" />{foodCostPct.toFixed(1)}%
                                </span>
                            )}
                        </div>
                    )}
                    {!editingPrice && (effectivePurchasePrice == null || effectivePurchasePrice <= 0) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <ClipboardList className="w-3.5 h-3.5" />Kein Einkaufspreis hinterlegt — Wareneinsatz unbekannt
                        </p>
                    )}
                </Card>

                {/* Aktionen */}
                {!editingPrice && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        <Button className="h-12" onClick={handleBehalten} disabled={updateMutation.isPending}>
                            <Check className="w-4 h-4 mr-1.5" />Behalten
                        </Button>
                        <Button variant="outline" className="h-12" onClick={() => { setEditingPrice(true); setPriceInput(String(current.price ?? "")); }}>
                            <Pencil className="w-4 h-4 mr-1.5" />Preis anpassen
                        </Button>
                        <Button variant="outline" className="h-12 text-muted-foreground" onClick={handleDeaktivieren} disabled={updateMutation.isPending}>
                            <EyeOff className="w-4 h-4 mr-1.5" />Deaktivieren
                        </Button>
                        <Button variant="outline" className="h-12 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(current)}>
                            <Trash2 className="w-4 h-4 mr-1.5" />Löschen
                        </Button>
                    </div>
                )}
                {!editingPrice && (
                    <button
                        type="button"
                        onClick={handleSkip}
                        className="w-full flex items-center justify-center gap-1.5 mt-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <SkipForward className="w-3.5 h-3.5" />Unsicher — später entscheiden
                    </button>
                )}
            </div>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>„{deleteTarget?.name}" endgültig löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Das Getränk wird unwiderruflich aus der Getränkekarte entfernt. Falls es nur vorübergehend
                            raus soll, nutze stattdessen „Deaktivieren" — das lässt sich jederzeit rückgängig machen.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleLoeschenConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Endgültig löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
