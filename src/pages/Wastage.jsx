import { toast } from 'sonner';
import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { STALE } from '@/lib/queryUtils';
import { format } from 'date-fns';
import { Trash2, Camera, Plus, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BarcodeScanner from '@/components/restock/BarcodeScanner';
import PDFExportButton from '@/components/export/PDFExportButton';
import { usePermissions } from '@/components/auth/usePermissions';
import PermissionDenied from '@/components/auth/PermissionDenied';
import WastageTemplates from '@/components/wastage/WastageTemplates';

const wastageTypes = [
    { value: 'Bruch',       label: 'Bruch (heruntergefallen)', icon: '💥', badgeClass: 'bg-destructive/10 text-destructive border-destructive/20' },
    { value: 'Nachtwächter',label: 'Nachtwächter',             icon: '🍺', badgeClass: 'bg-primary/10 text-primary border-primary/20' },
    { value: 'Verderb',     label: 'Verderb',                  icon: '🦠', badgeClass: 'bg-secondary text-secondary-foreground border-border' },
    { value: 'Sonstiges',   label: 'Sonstiges',                icon: '📋', badgeClass: 'bg-muted text-muted-foreground border-border' },
];

const statCardClasses = {
    Bruch:        'bg-destructive/10 border-destructive/20',
    Nachtwächter: 'bg-primary/10 border-primary/20',
    Verderb:      'bg-secondary border-border',
    Sonstiges:    'bg-muted border-border',
};

export default function Wastage() {
    const queryClient = useQueryClient();
    const permissions = usePermissions();
    const barcodeInputRef = useRef(null);

    const [searchQuery, setSearchQuery]       = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [scannerOpen, setScannerOpen]       = useState(false);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [quantity, setQuantity]             = useState('1');
    const [wastageType, setWastageType]       = useState('Bruch');
    const [notes, setNotes]                   = useState('');
    const [entryDate, setEntryDate]           = useState(format(new Date(), 'yyyy-MM-dd'));
    const [filterMonth, setFilterMonth]       = useState(format(new Date(), 'yyyy-MM'));
    const [filterType, setFilterType]         = useState('Alle');
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const { data: wastageItems = [] } = useQuery({
        queryKey: ['wastage-items', filterMonth],
        queryFn: async () => {
            const items = await base44.entities.Wastage.filter({ date: filterMonth }, '-created_date', 300);
            return items;
        },
        staleTime: STALE.MEDIUM,
    });

    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list(),
    });

    const { data: currentUser } = useQuery({
        queryKey: ['user'],
        queryFn: () => base44.auth.me(),
        staleTime: STALE.SLOW,
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.Wastage.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['wastage-items'] });
            toast.success('Schwund eingetragen ✓');
            resetForm();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Wastage.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wastage-items'] }),
    });

    const resetForm = () => {
        setSearchQuery('');
        setShowSuggestions(false);
        setSelectedArticle(null);
        setQuantity('1');
        setWastageType('Bruch');
        setNotes('');
        setEntryDate(format(new Date(), 'yyyy-MM-dd'));
        barcodeInputRef.current?.focus();
    };

    const handleSearchChange = (value) => {
        setSearchQuery(value);
        setSelectedArticle(null);
        setShowSuggestions(value.trim().length > 0);
    };

    const handleSelectArticle = (article) => {
        setSelectedArticle(article);
        setSearchQuery(article.name);
        setShowSuggestions(false);
    };

    const handleScan = (scannedBarcode) => {
        const article = articles.find(a => a.barcode === scannedBarcode);
        if (article) {
            handleSelectArticle(article);
            setScannerOpen(false);
        } else {
            toast.error('Artikel nicht in der Datenbank gefunden');
        }
    };

    const articleSuggestions = articles.filter(a =>
        a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.barcode?.includes(searchQuery)
    ).slice(0, 8);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedArticle) { toast.warning('Bitte wähle einen Artikel aus'); return; }
        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) { toast.warning('Bitte gültige Menge eingeben'); return; }

        await createMutation.mutateAsync({
            barcode: selectedArticle.barcode,
            article_name: selectedArticle.name,
            article_image_url: selectedArticle.image_url || null,
            quantity: qty,
            unit: wastageType === 'Nachtwächter' ? 'Liter' : 'Stück',
            type: wastageType,
            date: entryDate,
            time: format(new Date(), 'HH:mm'),
            noted_by: currentUser?.full_name || currentUser?.email || 'Unbekannt',
            notes: notes || null,
        });
    };

    const handleDelete = (id) => {
        setDeleteConfirmId(id);
    };

    // Filtered by month only (type filter applied separately in list)
    const monthItems = wastageItems.filter(item =>
        !filterMonth || item.date?.startsWith(filterMonth)
    );

    const filteredItems = monthItems.filter(item =>
        filterType === 'Alle' || item.type === filterType
    );

    const groupedItems = filteredItems.reduce((groups, item) => {
        if (!groups[item.date]) groups[item.date] = [];
        groups[item.date].push(item);
        return groups;
    }, {});

    // Stats always based on month (not type filter)
    const stats = wastageTypes.map(type => ({
        ...type,
        count: monthItems.filter(i => i.type === type.value).length,
    }));

    const monthlyTotal = monthItems.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);

    if (!permissions.canEditShopping) return <PermissionDenied />;

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-6xl mx-auto px-4 py-8">

                {/* Header */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground tracking-tight">Schwund & Verluste</h1>
                            <p className="text-muted-foreground text-sm mt-1">Dokumentation von Bruch, Nachtwächter und Verlusten</p>
                        </div>
                        <PDFExportButton
                            data={filteredItems}
                            filename={`schwund-${filterMonth}`}
                            title="Schwund & Verluste"
                            columns={[
                                { label: 'Datum',   field: 'date' },
                                { label: 'Artikel', field: 'article_name' },
                                { label: 'Menge',   field: 'quantity' },
                                { label: 'Art',     field: 'type' },
                                { label: 'Von',     field: 'noted_by' },
                                { label: 'Notizen', field: 'notes' },
                            ]}
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                        />
                    </div>

                    {/* Stats — 4 types + monthly total */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {stats.map(stat => (
                            <Card key={stat.value} className={`p-4 border ${statCardClasses[stat.value]}`}>
                                <div className="text-center">
                                    <div className="text-2xl mb-1">{stat.icon}</div>
                                    <div className="text-2xl font-bold text-foreground">{stat.count}</div>
                                    <div className="text-xs text-muted-foreground mt-1 truncate">{stat.label.split(' ')[0]}</div>
                                </div>
                            </Card>
                        ))}
                        <Card className="p-4 border bg-amber-500/10 border-amber-500/20 col-span-2 sm:col-span-1">
                            <div className="text-center">
                                <div className="text-2xl mb-1">📊</div>
                                <div className="text-2xl font-bold text-foreground">{monthlyTotal.toFixed(1)}</div>
                                <div className="text-xs text-muted-foreground mt-1">Gesamt (Monat)</div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Vorlagen */}
                <WastageTemplates
                    articles={articles}
                    currentUser={currentUser}
                    onApply={() => {}}
                />

                {/* Eingabe-Formular */}
                <Card className="p-6 bg-card border-border mb-6">
                    <h2 className="text-lg font-semibold text-foreground mb-4">Neuen Schwund eintragen</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            {/* Artikel-Suche */}
                            <div className="space-y-2">
                                <Label>Artikel suchen oder Barcode scannen</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            ref={barcodeInputRef}
                                            value={searchQuery}
                                            onChange={(e) => handleSearchChange(e.target.value)}
                                            onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                            placeholder="Artikelname oder Barcode..."
                                            className="min-h-[44px]"
                                            autoFocus
                                        />
                                        {showSuggestions && articleSuggestions.length > 0 && (
                                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                                                {articleSuggestions.map(article => (
                                                    <button
                                                        key={article.id}
                                                        type="button"
                                                        onMouseDown={() => handleSelectArticle(article)}
                                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors min-h-[44px]"
                                                    >
                                                        {article.image_url && (
                                                            <img src={article.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                                                        )}
                                                        <div className="min-w-0">
                                                            <p className="text-sm text-foreground truncate">{article.name}</p>
                                                            {article.barcode && <p className="text-xs text-muted-foreground">{article.barcode}</p>}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setScannerOpen(true)}
                                        className="min-h-[44px] w-full sm:w-auto"
                                    >
                                        <Camera className="w-4 h-4" />
                                    </Button>
                                </div>
                                {selectedArticle && (
                                    <div className="flex items-center gap-3 p-3 bg-accent rounded-lg">
                                        {selectedArticle.image_url && (
                                            <img
                                                src={selectedArticle.image_url}
                                                alt={selectedArticle.name}
                                                className="w-12 h-12 rounded object-cover"
                                            />
                                        )}
                                        <div>
                                            <p className="font-medium text-foreground">{selectedArticle.name}</p>
                                            <p className="text-xs text-muted-foreground">{selectedArticle.barcode}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Art */}
                            <div className="space-y-2">
                                <Label>Art des Schwunds</Label>
                                <Select value={wastageType} onValueChange={setWastageType}>
                                    <SelectTrigger className="min-h-[44px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {wastageTypes.map(type => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.icon} {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Menge {wastageType === 'Nachtwächter' ? '(in Litern)' : '(Stück)'}</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    placeholder={wastageType === 'Nachtwächter' ? 'z.B. 2.5' : 'z.B. 1'}
                                    className="min-h-[44px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Datum</Label>
                                <Input
                                    type="date"
                                    value={entryDate}
                                    onChange={(e) => setEntryDate(e.target.value)}
                                    className="min-h-[44px]"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Notizen (optional)</Label>
                            <Input
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="z.B. beim Aufräumen runtergefallen"
                                className="min-h-[44px]"
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={resetForm}
                                className="min-h-[44px]"
                            >
                                Zurücksetzen
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white min-h-[44px]"
                                disabled={!selectedArticle || createMutation.isPending}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {createMutation.isPending ? 'Speichern…' : 'Eintragen'}
                            </Button>
                        </div>
                    </form>
                </Card>

                {/* Filter */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="flex-1 max-w-xs">
                        <Label className="mb-1.5 block text-sm">Monat</Label>
                        <Input
                            type="month"
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="min-h-[44px]"
                        />
                    </div>
                    <div className="flex-1 max-w-xs">
                        <Label className="mb-1.5 block text-sm">Typ filtern</Label>
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger className="min-h-[44px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Alle">Alle</SelectItem>
                                {wastageTypes.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.value}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Liste */}
                {Object.keys(groupedItems).length > 0 ? (
                    <div className="space-y-6">
                        {Object.entries(groupedItems)
                            .sort(([a], [b]) => b.localeCompare(a))
                            .map(([date, items]) => (
                                <div key={date}>
                                    <h3 className="text-sm font-semibold text-amber-500 mb-3">
                                        {format(new Date(date + 'T12:00:00'), 'dd.MM.yyyy')}
                                    </h3>
                                    <div className="space-y-2">
                                        {items.map(item => {
                                            const typeConfig = wastageTypes.find(t => t.value === item.type);
                                            return (
                                                <Card key={item.id} className="p-4 bg-card border-border">
                                                    <div className="flex items-center gap-3">
                                                        {item.article_image_url && (
                                                            <img
                                                                src={item.article_image_url}
                                                                alt={item.article_name}
                                                                className="w-12 h-12 rounded-lg object-cover border border-border"
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                <h4 className="font-medium text-foreground truncate">
                                                                    {item.article_name}
                                                                </h4>
                                                                <Badge className={typeConfig?.badgeClass || 'bg-muted text-muted-foreground'}>
                                                                    {typeConfig?.icon} {item.type}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                                                <span className="font-semibold text-amber-500">
                                                                    {item.quantity} {item.unit || 'Stück'}
                                                                </span>
                                                                <span>•</span>
                                                                <span>{item.time} Uhr</span>
                                                                <span>•</span>
                                                                <span>{item.noted_by}</span>
                                                                {item.notes && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span className="italic">{item.notes}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(item.id)}
                                                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 min-h-[44px]"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                    </div>
                ) : (
                    <Card className="p-12 bg-card border-border">
                        <div className="text-center text-muted-foreground">
                            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-lg font-medium">Keine Einträge</p>
                            <p className="text-sm mt-1">Für diesen Monat wurden noch keine Verluste dokumentiert</p>
                        </div>
                    </Card>
                )}

                <BarcodeScanner
                    open={scannerOpen}
                    onClose={() => setScannerOpen(false)}
                    onScan={handleScan}
                />
            </div>
        </div>
            {/* Delete Confirm Dialog */}
            <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Dieser Schwundeintrag wird dauerhaft gelöscht.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { deleteMutation.mutate(deleteConfirmId); setDeleteConfirmId(null); }}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                            Löschen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}