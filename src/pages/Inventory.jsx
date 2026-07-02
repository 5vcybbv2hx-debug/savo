import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { queueMutation, syncMutations } from '@/components/utils/offlineSync';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { Camera, Save, RotateCcw, Cloud, CloudOff } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card } from "@/components/ui/card";
import { usePermissions } from '@/components/auth/usePermissions';
import { toast } from 'sonner';
import PermissionDenied from '@/components/auth/PermissionDenied';
import BarcodeScanner from '@/components/restock/BarcodeScanner';
import PDFExportButton from '@/components/export/PDFExportButton';
import SlotCountingSection from '@/components/inventory/SlotCountingSection';
import UnassignedArticlesSection from '@/components/inventory/UnassignedArticlesSection';

export default function Inventory() {
    const permissions = usePermissions();
    const queryClient = useQueryClient();

    // ── State ──────────────────────────────────────────────────────────────────
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scanMode, setScanMode] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [lastScanned, setLastScanned] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [activeArticle, setActiveArticle] = useState(null);

    // Fach-basierte Zählung: slotValues ist vorbefüllt mit assignment.quantity
    const [slotValues, setSlotValues] = useState(() => {
        try { return JSON.parse(localStorage.getItem('inv_slot_values') || '{}'); }
        catch { return {}; }
    });
    // Trackt welche Zuordnungen der Nutzer bearbeitet hat (für Fortschritt)
    const [touchedAssignments, setTouchedAssignments] = useState(() => {
        try { return JSON.parse(localStorage.getItem('inv_touched') || '{}'); }
        catch { return {}; }
    });

    // Nicht-zugeordnete Artikel: flache Zähl-Liste (wie bisher)
    const [unassignedCounts, setUnassignedCounts] = useState(() => {
        try { return JSON.parse(localStorage.getItem('inv_unassigned_counts') || '{}'); }
        catch { return {}; }
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');

    // ── localStorage persistence (Offline-Schutz: Zähldaten dürfen nicht verloren gehen) ──
    useEffect(() => {
        localStorage.setItem('inv_slot_values', JSON.stringify(slotValues));
    }, [slotValues]);
    useEffect(() => {
        localStorage.setItem('inv_touched', JSON.stringify(touchedAssignments));
    }, [touchedAssignments]);
    useEffect(() => {
        localStorage.setItem('inv_unassigned_counts', JSON.stringify(unassignedCounts));
    }, [unassignedCounts]);

    // ── Online/offline detection ──
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // ── Queries ────────────────────────────────────────────────────────────────
    const { data: areas = [] } = useQuery({
        queryKey: ['inv-areas'],
        queryFn: () => base44.entities.Area.list('name', 1000),
        staleTime: STALE.SLOW,
    });
    const { data: slots = [] } = useQuery({
        queryKey: ['inv-slots'],
        queryFn: () => base44.entities.StorageSlot.list('full_name', 1000),
        staleTime: STALE.MEDIUM,
    });
    const { data: assignments = [] } = useQuery({
        queryKey: ['inv-assignments'],
        queryFn: () => base44.entities.StorageAssignment.filter({ is_active: true }, 'article_name', 1000),
        staleTime: STALE.MEDIUM,
    });
    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list('name', 1000),
    });
    const { data: categories = [] } = useQuery({
        queryKey: ['article-categories'],
        queryFn: () => base44.entities.ArticleCategory.list('order'),
    });
    const { data: currentUser } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me(),
        staleTime: STALE.SLOW,
    });

    // ── slotValues aus assignment.quantity initialisieren (Vorbefüllung) ────────
    useEffect(() => {
        if (assignments.length > 0) {
            setSlotValues(prev => {
                let changed = false;
                const next = { ...prev };
                assignments.forEach(a => {
                    if (next[a.id] === undefined) {
                        next[a.id] = a.quantity ?? 0;
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }
    }, [assignments]);

    // ── Derived data ───────────────────────────────────────────────────────────
    const assignmentsBySlot = useMemo(() => {
        const map = {};
        assignments.forEach(a => {
            if (!map[a.storage_slot_id]) map[a.storage_slot_id] = [];
            map[a.storage_slot_id].push(a);
        });
        return map;
    }, [assignments]);

    const assignedArticleIds = useMemo(() =>
        new Set(assignments.map(a => a.article_id)),
        [assignments]
    );

    const unassignedArticles = useMemo(() =>
        articles.filter(a => !assignedArticleIds.has(a.id)),
        [articles, assignedArticleIds]
    );

    // Interagierte Artikel (mind. eine berührte Zuordnung ODER Eintrag im Nicht-zugeordnet-Bereich)
    const interactedArticleIds = useMemo(() => {
        const ids = new Set();
        for (const a of assignments) {
            if (touchedAssignments[a.id]) ids.add(a.article_id);
        }
        for (const id of Object.keys(unassignedCounts)) {
            ids.add(id);
        }
        return ids;
    }, [assignments, touchedAssignments, unassignedCounts]);

    // Aggregierte gezählte Menge pro Artikel (ALLE Zuordnungen + Nicht-zugeordnet)
    const articleAggregates = useMemo(() => {
        const agg = {};
        for (const a of assignments) {
            if (interactedArticleIds.has(a.article_id)) {
                const count = slotValues[a.id] ?? a.quantity ?? 0;
                agg[a.article_id] = (agg[a.article_id] || 0) + count;
            }
        }
        for (const [id, count] of Object.entries(unassignedCounts)) {
            agg[id] = (agg[id] || 0) + count;
        }
        return agg;
    }, [assignments, interactedArticleIds, slotValues, unassignedCounts]);

    // ── Fortschritt & Stats ────────────────────────────────────────────────────
    const { countedSlots, totalSlots, totalDiff } = useMemo(() => {
        const slotsWithAssignments = slots.filter(s =>
            assignmentsBySlot[s.id]?.length > 0
        );
        const counted = slotsWithAssignments.filter(s =>
            assignmentsBySlot[s.id].every(a => touchedAssignments[a.id])
        ).length;

        const diff = [...interactedArticleIds].reduce((sum, id) => {
            const article = articles.find(a => a.id === id);
            return sum + Math.abs((articleAggregates[id] || 0) - (article?.current_stock || 0));
        }, 0);

        return { countedSlots: counted, totalSlots: slotsWithAssignments.length, totalDiff: diff };
    }, [slots, assignmentsBySlot, touchedAssignments, interactedArticleIds, articleAggregates, articles]);

    const totalItemsCounted = Object.keys(touchedAssignments).length + Object.keys(unassignedCounts).length;

    // ── Count handlers ─────────────────────────────────────────────────────────
    const handleSlotCountChange = (assignmentId, value) => {
        const numValue = parseInt(value) || 0;
        setSlotValues(prev => ({ ...prev, [assignmentId]: numValue }));
        setTouchedAssignments(prev => ({ ...prev, [assignmentId]: true }));
    };

    const handleUnassignedCountChange = (articleId, value) => {
        const numValue = parseInt(value) || 0;
        setUnassignedCounts(prev => ({ ...prev, [articleId]: numValue }));
        setActiveArticle(articleId);
    };

    // ── Barcode scan ───────────────────────────────────────────────────────────
    const handleScan = (barcode) => {
        const article = articles.find(a => a.barcode === barcode);
        if (!article) {
            toast.error(`Artikel nicht gefunden: ${barcode}`);
            return;
        }

        const articleAssignments = assignments.filter(a => a.article_id === article.id && a.is_active !== false);

        if (articleAssignments.length > 0) {
            // Artikel ist in Fächern zugeordnet → erste Zuordnung hochzählen
            const assignment = articleAssignments[0];
            const current = slotValues[assignment.id] ?? assignment.quantity ?? 0;
            setSlotValues(prev => ({ ...prev, [assignment.id]: current + 1 }));
            setTouchedAssignments(prev => ({ ...prev, [assignment.id]: true }));
            setLastScanned({
                name: article.name,
                count: current + 1,
                slot: assignment.slot_full_name,
                timestamp: Date.now()
            });
        } else {
            // Nicht zugeordneter Artikel
            const current = unassignedCounts[article.id] || 0;
            setUnassignedCounts(prev => ({ ...prev, [article.id]: current + 1 }));
            setActiveArticle(article.id);
            setLastScanned({
                name: article.name,
                count: current + 1,
                timestamp: Date.now()
            });
            setTimeout(() => {
                document.getElementById(`article-${article.id}`)?.scrollIntoView({
                    behavior: 'smooth', block: 'center'
                });
            }, 100);
        }

        setTimeout(() => setLastScanned(null), 2000);
    };

    // ── Save mutation (Offline-fähig via queueMutation) ────────────────────────
    const saveMutation = useMutation({
        mutationFn: async () => {
            // 1. Berührte Zuordnungen mit geändertem Wert updaten
            const changedAssignments = assignments.filter(a =>
                touchedAssignments[a.id] && slotValues[a.id] !== a.quantity
            );

            // 2. Aggregierte Counts pro Artikel
            const countsData = [...interactedArticleIds].map(id => {
                const article = articles.find(a => a.id === id);
                const systemStock = article?.current_stock || 0;
                const counted = articleAggregates[id] || 0;
                return {
                    article_id: id,
                    article_name: article?.name,
                    system_stock: systemStock,
                    counted_stock: counted,
                    difference: counted - systemStock
                };
            });

            const totalDiffVal = countsData.reduce((sum, c) => sum + Math.abs(c.difference), 0);
            // 3. Nur Artikel mit Abweichung updaten
            const changedArticles = countsData.filter(c => c.difference !== 0);

            const sessionPayload = {
                date: new Date().toISOString(),
                counted_by: currentUser?.full_name || 'Unbekannt',
                counts: countsData,
                total_items: countsData.length,
                total_difference: totalDiffVal
            };

            // ⚠️ Nach 30-60 Minuten Zählen im Keller darf der finale "Abschließen"-Tap
            // nicht an einem WLAN-Hänger scheitern — sonst muss alles neu gezählt
            // wirken, obwohl die Daten eigentlich nur nicht hochgeladen wurden.
            let offline = !navigator.onLine;
            if (!offline) {
                try {
                    await Promise.all(changedAssignments.map(a =>
                        base44.entities.StorageAssignment.update(a.id, { quantity: slotValues[a.id] })
                    ));
                    await Promise.all(changedArticles.map(c =>
                        base44.entities.Article.update(c.article_id, { current_stock: c.counted_stock })
                    ));
                    await base44.entities.InventorySession.create(sessionPayload);
                } catch (err) {
                    offline = true;
                }
            }
            if (offline) {
                for (const a of changedAssignments) {
                    await queueMutation({
                        entityName: 'StorageAssignment', type: 'update',
                        id: a.id, data: { quantity: slotValues[a.id] }
                    });
                }
                for (const c of changedArticles) {
                    await queueMutation({
                        entityName: 'Article', type: 'update',
                        id: c.article_id, data: { current_stock: c.counted_stock }
                    });
                }
                await queueMutation({
                    entityName: 'InventorySession', type: 'create',
                    data: sessionPayload
                });
            }

            return { result: sessionPayload, offline, changedCount: changedArticles.length };
        },
        onSuccess: ({ result, offline, changedCount }) => {
            // Reset: touched + unassigned löschen, slotValues auf alte Quantities zurücksetzen
            setTouchedAssignments({});
            setUnassignedCounts({});
            const initial = {};
            assignments.forEach(a => { initial[a.id] = a.quantity ?? 0; });
            setSlotValues(initial);
            setActiveArticle(null);

            localStorage.removeItem('inv_touched');
            localStorage.removeItem('inv_unassigned_counts');
            localStorage.setItem('inv_slot_values', JSON.stringify(initial));

            if (!offline) {
                queryClient.invalidateQueries({ queryKey: ['articles'] });
                queryClient.invalidateQueries({ queryKey: ['inv-assignments'] });
            }
            queryClient.setQueryData(['inventory-sessions'], (old) =>
                old ? [...old, result] : [result]
            );

            if (offline) {
                toast.success('Inventur gespeichert (offline) ⚡ — wird synchronisiert sobald wieder online');
            } else {
                toast.success(changedCount > 0
                    ? `Inventur abgeschlossen — ${changedCount} Bestände wurden korrigiert`
                    : 'Inventur abgeschlossen — Keine Abweichungen'
                );
            }
        },
        onError: (error) => {
            toast.error('Fehler beim Speichern: ' + error.message);
        }
    });

    // ── Beim Reconnect gequeute Daten nachsynchen ──────────────────────────────
    useEffect(() => {
        const handleOnline = () => {
            syncMutations(base44)
                .then(() => {
                    queryClient.invalidateQueries({ queryKey: ['articles'] });
                    queryClient.invalidateQueries({ queryKey: ['inv-assignments'] });
                })
                .catch(console.error);
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [queryClient]);

    // ── Actions ────────────────────────────────────────────────────────────────
    const hasAnyCounts = totalItemsCounted > 0;

    const handleSave = () => {
        if (!hasAnyCounts) {
            toast.warning('Keine Zählungen vorhanden');
            return;
        }
        setSaveDialogOpen(true);
    };

    const handleSaveConfirmed = () => {
        setSaveDialogOpen(false);
        saveMutation.mutate();
    };

    const handleResetConfirmed = () => {
        setResetDialogOpen(false);
        setTouchedAssignments({});
        setUnassignedCounts({});
        const initial = {};
        assignments.forEach(a => { initial[a.id] = a.quantity ?? 0; });
        setSlotValues(initial);
        setActiveArticle(null);
    };

    // ── PDF export data ────────────────────────────────────────────────────────
    const pdfData = useMemo(() => {
        return [...interactedArticleIds].map(id => {
            const article = articles.find(a => a.id === id);
            const counted = articleAggregates[id] || 0;
            return {
                ...article,
                counted_stock: counted,
                difference: counted - (article?.current_stock || 0),
                total_value: counted * (article?.purchase_price || 0)
            };
        });
    }, [interactedArticleIds, articleAggregates, articles]);

    if (!permissions.canEditShopping) {
        return <PermissionDenied />;
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
                {/* Header */}
                <div className="flex flex-col gap-3 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Inventur</h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                {countedSlots} von {totalSlots} Fächern gezählt
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {isOnline ? (
                                <Cloud className="w-5 h-5 text-green-500" />
                            ) : (
                                <CloudOff className="w-5 h-5 text-amber-500" />
                            )}
                            <span className="text-xs text-muted-foreground">
                                {isOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        <Button
                            onClick={() => {
                                setScanMode(!scanMode);
                                if (!scanMode) setScannerOpen(true);
                            }}
                            className={scanMode ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}
                        >
                            <Camera className="w-4 h-4 mr-2" />
                            {scanMode ? 'Scannen aktiv' : 'Scanner starten'}
                        </Button>
                        <PDFExportButton
                            data={pdfData}
                            filename={`inventur_${new Date().toISOString().split('T')[0]}`}
                            title="Inventur-Bericht"
                            columns={[
                                { label: 'Artikel', field: 'name' },
                                { label: 'Barcode', field: 'barcode' },
                                { label: 'Kategorie', field: 'category' },
                                { label: 'Lieferant', render: (a) => a.suppliers?.join(', ') || '-' },
                                { label: 'Soll-Bestand', field: 'current_stock' },
                                { label: 'Ist-Bestand', field: 'counted_stock' },
                                { label: 'Differenz', render: (a) => {
                                    const diff = a.difference;
                                    return diff > 0 ? `+${diff}` : `${diff}`;
                                }},
                                { label: 'EK-Preis (€)', render: (a) => a.purchase_price?.toFixed(2) || '-' },
                                { label: 'Gesamtwert (€)', render: (a) => a.total_value?.toFixed(2) || '-' }
                            ]}
                            variant="outline"
                            className="border-purple-600 text-foreground bg-purple-600 hover:bg-purple-700"
                            disabled={!hasAnyCounts}
                        />
                        <Button
                            onClick={handleSave}
                            disabled={!hasAnyCounts}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            Speichern ({totalItemsCounted})
                        </Button>
                        <Button
                            onClick={() => setResetDialogOpen(true)}
                            variant="outline"
                            className="border-red-600 text-foreground bg-red-600 hover:bg-red-700"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Zurücksetzen
                        </Button>
                    </div>
                </div>

                {/* Last Scanned Notification */}
                {lastScanned && (
                    <div className="mb-4 p-4 bg-green-600 rounded-lg border-2 border-green-400 animate-pulse">
                        <div className="flex items-center gap-2">
                            <Camera className="w-5 h-5 text-foreground" />
                            <div>
                                <p className="font-semibold text-foreground">{lastScanned.name}</p>
                                <p className="text-sm text-green-100">
                                    Menge: {lastScanned.count}
                                    {lastScanned.slot && ` · ${lastScanned.slot}`}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <Card className="p-4 bg-card border-border">
                        <p className="text-sm text-muted-foreground mb-1">Fächer gezählt</p>
                        <p className="text-2xl font-bold text-foreground">{countedSlots}</p>
                    </Card>
                    <Card className="p-4 bg-card border-border">
                        <p className="text-sm text-muted-foreground mb-1">Fächer offen</p>
                        <p className="text-2xl font-bold text-amber-500">{totalSlots - countedSlots}</p>
                    </Card>
                    <Card className="p-4 bg-card border-border">
                        <p className="text-sm text-muted-foreground mb-1">Differenzen</p>
                        <p className="text-2xl font-bold text-red-500">{totalDiff}</p>
                    </Card>
                </div>

                {/* Fach-basierte Zählung */}
                <div className="mb-8">
                    <h2 className="text-lg font-bold text-foreground mb-3">Fach-basierte Zählung</h2>
                    <SlotCountingSection
                        areas={areas}
                        slots={slots}
                        assignments={assignments}
                        articles={articles}
                        slotValues={slotValues}
                        touchedAssignments={touchedAssignments}
                        onCountChange={handleSlotCountChange}
                    />
                </div>

                {/* Nicht zugeordnete Artikel */}
                <UnassignedArticlesSection
                    articles={unassignedArticles}
                    counts={unassignedCounts}
                    categories={categories}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    filterCategory={filterCategory}
                    setFilterCategory={setFilterCategory}
                    activeArticle={activeArticle}
                    onCountChange={handleUnassignedCountChange}
                />

                <BarcodeScanner
                    open={scannerOpen}
                    onClose={() => {
                        setScannerOpen(false);
                        setScanMode(false);
                    }}
                    onScan={(barcode) => {
                        handleScan(barcode);
                        if (scanMode) {
                            setTimeout(() => {
                                setScannerOpen(true);
                            }, 100);
                        }
                    }}
                />
            </div>

            {/* Inventur speichern Dialog */}
            <AlertDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Inventur speichern?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {totalItemsCounted} Zählungen werden als Inventursitzung gespeichert.
                            Fächer-Zuordnungen werden aktualisiert und Artikel-Bestände bei Abweichungen korrigiert.
                            Die Zählungen werden danach zurückgesetzt.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSaveConfirmed}>Speichern</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Zählungen zurücksetzen Dialog */}
            <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Alle Zählungen zurücksetzen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Alle eingegebenen Zählwerte werden gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleResetConfirmed}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                            Zurücksetzen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}