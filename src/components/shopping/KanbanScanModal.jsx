import React, { useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { queueMutation, syncMutations } from '@/components/utils/offlineSync';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertCircle, PlusCircle, QrCode, RefreshCw, Flame, AlertTriangle, Info } from 'lucide-react';
import BarcodeScanner from '@/components/restock/BarcodeScanner';
import { cn } from '@/lib/utils';

const URGENCY = [
    { value: 'dringend', label: 'Dringend', icon: Flame,         color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30' },
    { value: 'bald',     label: 'Bald',     icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/30' },
    { value: 'normal',   label: 'Normal',   icon: Info,           color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30' },
];

function UrgencyPicker({ value, onChange }) {
    return (
        <div className="flex gap-2">
            {URGENCY.map(u => (
                <button
                    key={u.value}
                    type="button"
                    onClick={() => onChange(u.value)}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-all',
                        value === u.value ? `${u.bg} ${u.color}` : 'border-border text-muted-foreground hover:bg-accent/50'
                    )}
                >
                    <u.icon className="w-3.5 h-3.5" />
                    {u.label}
                </button>
            ))}
        </div>
    );
}

export default function KanbanScanModal({ open, onClose, suppliers = [] }) {
    const queryClient = useQueryClient();
    const [scannerOpen, setScannerOpen] = useState(false);
    const [pendingArticle, setPendingArticle] = useState(null); // article being confirmed
    const [qty, setQty] = useState(1);
    const [urgency, setUrgency] = useState('normal');
    const [feedback, setFeedback] = useState(null);
    const [sessionLog, setSessionLog] = useState([]);

    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list('name'),
        enabled: open
    });

    const { data: shoppingItems = [] } = useQuery({
        queryKey: ['shopping-list'],
        queryFn: () => base44.entities.ShoppingList.list('-created_date'),
        enabled: open
    });

    // Wird per Barcode-Scan direkt im Keller genutzt -> oft schlechter Empfang.
    // Hinzufuegen/Erhoehen darf dabei nicht scheitern, sonst verliert man beim
    // Scannen den Ueberblick, was schon erfasst wurde.
    const createMutation = useMutation({
        mutationFn: async (data) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'ShoppingList', type: 'create', data });
                return { ...data, id: `offline-${Date.now()}`, _offline: true };
            }
            try {
                return await base44.entities.ShoppingList.create(data);
            } catch (err) {
                await queueMutation({ entityName: 'ShoppingList', type: 'create', data });
                return { ...data, id: `offline-${Date.now()}`, _offline: true };
            }
        },
        onSuccess: (result) => {
            if (result?._offline) {
                queryClient.setQueryData(['shopping-list'], (old = []) => [result, ...old]);
            } else {
                queryClient.invalidateQueries(['shopping-list']);
            }
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            if (!navigator.onLine) {
                await queueMutation({ entityName: 'ShoppingList', type: 'update', id, data });
                return { id, data, offline: true };
            }
            try {
                await base44.entities.ShoppingList.update(id, data);
                return { id, data, offline: false };
            } catch (err) {
                await queueMutation({ entityName: 'ShoppingList', type: 'update', id, data });
                return { id, data, offline: true };
            }
        },
        onSuccess: ({ id, data, offline }) => {
            if (offline) {
                queryClient.setQueryData(['shopping-list'], (old = []) =>
                    old.map(i => i.id === id ? { ...i, ...data } : i)
                );
            } else {
                queryClient.invalidateQueries(['shopping-list']);
            }
        }
    });

    // Beim Reconnect automatisch gequeute Kanban-Scans nachsynchen
    useEffect(() => {
        const handleOnline = () => {
            syncMutations(base44)
                .then(() => queryClient.invalidateQueries(['shopping-list']))
                .catch(console.error);
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [queryClient]);

    const showFeedback = (fb) => {
        setFeedback(fb);
        setSessionLog(prev => [{ ...fb, time: new Date().toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' }) }, ...prev].slice(0, 15));
        setTimeout(() => setFeedback(null), 4000);
    };

    // Called after user confirms the pending article
    const handleConfirm = useCallback(async () => {
        if (!pendingArticle) return;
        const { article, existing } = pendingArticle;
        const urgencyNote = urgency !== 'normal' ? ` [${URGENCY.find(u => u.value === urgency)?.label}]` : '';

        if (existing) {
            const newQty = parseFloat(existing.quantity || 1) + parseFloat(qty);
            await updateMutation.mutateAsync({
                id: existing.id,
                data: {
                    ...existing,
                    quantity: newQty,
                    notes: [existing.notes, `+${qty} via Kanban${urgencyNote}`].filter(Boolean).join(' | ')
                }
            });
            showFeedback({ type: 'updated', name: article.name, qty: newQty });
        } else {
            const _ps = article.supplier_details?.find(s => s.is_primary) || article.supplier_details?.[0];
            const _d  = (_ps?.packaging_options || []).find(o => o.is_default) || (_ps?.packaging_options || [])[0];
            const _sn = _ps?.supplier_name || article.suppliers?.[0] || suppliers[0]?.name || '';
            await createMutation.mutateAsync({
                item_name:           article.name,
                article_id:          article.id,
                category:            _sn,
                supplier_name:       _sn,
                packaging_option_id: _d?.id || null,
                packaging_label:     _d ? `${_d.packaging_type} ${_d.units_per_pack}×` : null,
                price_per_unit:      _d?.price_per_unit || article.purchase_price || null,
                quantity:            parseFloat(qty),
                unit:                _d?.packaging_type || 'Stück',
                status:              'offen',
                notes:               `Kanban${urgencyNote}${article.barcode ? ` · ${article.barcode}` : ''}`
            });
            showFeedback({ type: 'added', name: article.name, qty });
        }

        setPendingArticle(null);
        setQty(1);
        setUrgency('normal');
    }, [pendingArticle, qty, urgency, createMutation, updateMutation, suppliers]);

    const handleScan = useCallback((barcode) => {
        setScannerOpen(false);

        const article = articles.find(a =>
            a.barcode === barcode ||
            a.name.toLowerCase() === barcode.toLowerCase()
        );

        if (!article) {
            showFeedback({ type: 'notfound', name: barcode });
            return;
        }

        const latest = queryClient.getQueryData(['shopping-list']) || shoppingItems;
        const existing = latest.find(i => i.item_name === article.name && i.status === 'offen');

        // Suggest quantity: min_stock - current_stock if available, else 1
        const suggested = article.min_stock && article.current_stock != null
            ? Math.max(1, article.min_stock - article.current_stock)
            : 1;

        setQty(suggested);
        setUrgency(article.current_stock === 0 ? 'dringend' : article.current_stock <= (article.min_stock || 0) ? 'bald' : 'normal');
        setPendingArticle({ article, existing });
    }, [articles, shoppingItems, queryClient]);

    const handleClose = () => {
        setScannerOpen(false);
        setFeedback(null);
        setSessionLog([]);
        setPendingArticle(null);
        onClose();
    };

    const urgencyConfig = URGENCY.find(u => u.value === urgency);

    return (
        <>
            <Dialog open={open && !scannerOpen} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <QrCode className="w-5 h-5 text-amber-500" />
                            Kanban-Scan
                        </DialogTitle>
                    </DialogHeader>

                    {/* Feedback banner */}
                    {feedback && (
                        <div className={cn('flex items-center gap-3 p-3 rounded-lg text-sm font-medium border',
                            feedback.type === 'added'    ? 'bg-green-500/15 text-green-400 border-green-500/30' :
                            feedback.type === 'updated'  ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                                                           'bg-red-500/15 text-red-400 border-red-500/30'
                        )}>
                            {feedback.type === 'added'    && <PlusCircle className="w-5 h-5 shrink-0" />}
                            {feedback.type === 'updated'  && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                            {feedback.type === 'notfound' && <AlertCircle className="w-5 h-5 shrink-0" />}
                            <span>
                                {feedback.type === 'added'    && `Hinzugefügt: ${feedback.name} (${feedback.qty}×)`}
                                {feedback.type === 'updated'  && `Aktualisiert: ${feedback.name} → ${feedback.qty}×`}
                                {feedback.type === 'notfound' && `Nicht gefunden: ${feedback.name}`}
                            </span>
                        </div>
                    )}

                    {/* Pending confirmation */}
                    {pendingArticle ? (
                        <div className="space-y-4 border border-border rounded-xl p-4">
                            <div>
                                <p className="font-semibold text-foreground">{pendingArticle.article.name}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {pendingArticle.article.category}
                                    {pendingArticle.article.current_stock != null && (
                                        <span className="ml-2">Bestand: <strong>{pendingArticle.article.current_stock}</strong></span>
                                    )}
                                </p>
                                {pendingArticle.existing && (
                                    <Badge variant="outline" className="mt-1 text-xs border-amber-500/40 text-amber-400">
                                        Bereits auf Liste ({pendingArticle.existing.quantity}×) – wird erhöht
                                    </Badge>
                                )}
                            </div>

                            <div>
                                <Label className="text-xs mb-1.5 block">Menge</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={qty}
                                    onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-24"
                                />
                            </div>

                            <div>
                                <Label className="text-xs mb-1.5 block">Dringlichkeit</Label>
                                <UrgencyPicker value={urgency} onChange={setUrgency} />
                            </div>

                            <div className="flex gap-2 pt-1">
                                <Button variant="outline" className="flex-1" onClick={() => setPendingArticle(null)}>
                                    Abbrechen
                                </Button>
                                <Button
                                    className={cn('flex-1 gap-2', urgency === 'dringend' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700')}
                                    onClick={handleConfirm}
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                >
                                    {urgencyConfig && <urgencyConfig.icon className="w-4 h-4" />}
                                    Bestätigen
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            onClick={() => setScannerOpen(true)}
                            className="w-full h-16 text-base bg-amber-600 hover:bg-amber-700 gap-3"
                        >
                            <QrCode className="w-6 h-6" />
                            Barcode / QR-Code scannen
                        </Button>
                    )}

                    {/* Session log */}
                    {sessionLog.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Sitzungsprotokoll ({sessionLog.length})
                            </p>
                            <div className="space-y-1 max-h-44 overflow-y-auto">
                                {sessionLog.map((log, i) => {
                                    const urg = URGENCY.find(u => u.value === log.urgency);
                                    return (
                                        <div key={i} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md bg-secondary/50">
                                            {log.type === 'added'    && <PlusCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                                            {log.type === 'updated'  && <RefreshCw className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                                            {log.type === 'notfound' && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                                            <span className="flex-1 truncate">{log.name}</span>
                                            {log.qty != null && <Badge variant="outline" className="text-xs shrink-0">{log.qty}×</Badge>}
                                            <span className="text-xs text-muted-foreground shrink-0">{log.time}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <Button variant="outline" onClick={handleClose} className="w-full">
                        Schließen
                    </Button>
                </DialogContent>
            </Dialog>

            <BarcodeScanner
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScan={handleScan}
                mode="kanban"
            />
        </>
    );
}