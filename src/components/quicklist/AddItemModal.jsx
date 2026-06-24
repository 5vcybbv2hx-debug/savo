import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, X } from 'lucide-react';
import { format } from 'date-fns';

/**
 * AddItemModal — Dual-Mode Eingabe für die Einkaufsliste.
 * Mode 1 "Aus Datenbank": Autocomplete auf Article-Entity.
 * Mode 2 "Freitext": Manuelle Eingabe von Name + Kategorie.
 */
export default function AddItemModal({ open, onClose, onConfirm, articles = [] }) {
    const [mode, setMode] = useState('database');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [itemName, setItemName] = useState('');
    const [category, setCategory] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unit, setUnit] = useState('Stück');
    const [notes, setNotes] = useState('');

    const searchMatches = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return articles.filter(a =>
            a.name?.toLowerCase().includes(q) || a.barcode?.includes(searchQuery)
        ).slice(0, 8);
    }, [searchQuery, articles]);

    const reset = () => {
        setMode('database');
        setSearchQuery('');
        setSelectedArticle(null);
        setItemName('');
        setCategory('');
        setQuantity(1);
        setUnit('Stück');
        setNotes('');
    };

    const handleClose = () => { reset(); onClose(); };

    const handleArticleSelect = (article) => {
        setSelectedArticle(article);
        setSearchQuery('');
        setUnit(article.content_unit || 'Stück');
    };

    const handleSubmit = () => {
        const isDb = mode === 'database' && selectedArticle;
        const data = {
            item_name: isDb ? selectedArticle.name : itemName.trim(),
            article_id: isDb ? selectedArticle.id : null,
            article_image_url: isDb ? (selectedArticle.image_url || null) : null,
            quantity: Number(quantity) || 1,
            unit: unit || 'Stück',
            category: isDb
                ? (selectedArticle.category || 'Sonstiges')
                : (category.trim() || 'Sonstiges'),
            is_completed: false,
            notes: notes.trim() || null,
            date: format(new Date(), 'yyyy-MM-dd'),
        };
        if (!data.item_name) return;
        onConfirm(data);
        reset();
    };

    const canSubmit = mode === 'database'
        ? !!selectedArticle
        : itemName.trim().length > 0;

    return (
        <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-foreground">Artikel hinzufügen</DialogTitle>
                </DialogHeader>

                {/* Mode Chips */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => { setMode('database'); setSelectedArticle(null); }}
                        className={cn(
                            'flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all min-h-[44px]',
                            mode === 'database'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:text-foreground'
                        )}
                    >
                        Aus Datenbank
                    </button>
                    <button
                        onClick={() => { setMode('freetext'); setSelectedArticle(null); }}
                        className={cn(
                            'flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all min-h-[44px]',
                            mode === 'freetext'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:text-foreground'
                        )}
                    >
                        Freitext
                    </button>
                </div>

                <div className="space-y-4">
                    {/* ── Database Mode ─────────────────────────────────── */}
                    {mode === 'database' && (
                        <div>
                            {selectedArticle ? (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary border border-border">
                                    {selectedArticle.image_url && (
                                        <img
                                            src={selectedArticle.image_url}
                                            alt=""
                                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-foreground truncate">
                                            {selectedArticle.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedArticle.category || 'Sonstiges'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedArticle(null)}
                                        className="text-muted-foreground hover:text-foreground p-1"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Artikel suchen…"
                                        className="h-11 bg-background border-border/70"
                                        autoFocus
                                        autoComplete="off"
                                    />
                                    {searchMatches.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-card border border-border/70 rounded-xl shadow-xl z-20">
                                            {searchMatches.map(article => (
                                                <button
                                                    key={article.id}
                                                    onClick={() => handleArticleSelect(article)}
                                                    className="w-full px-4 py-3 text-left hover:bg-secondary border-b border-border/40 last:border-0 transition-colors active:scale-[0.98] min-h-[44px]"
                                                >
                                                    <div className="font-medium text-foreground text-sm">
                                                        {article.name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        {article.category || 'Sonstiges'}
                                                        {article.content_unit ? ` · ${article.content_unit}` : ''}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {searchQuery.trim().length >= 2 && searchMatches.length === 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/70 rounded-xl shadow-xl z-20 px-4 py-3 text-sm text-muted-foreground text-center">
                                            Kein Artikel gefunden — wechsle zu „Freitext"
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Freetext Mode ─────────────────────────────────── */}
                    {mode === 'freetext' && (
                        <>
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">Artikelname</label>
                                <Input
                                    type="text"
                                    value={itemName}
                                    onChange={(e) => setItemName(e.target.value)}
                                    placeholder="z.B. Limetten"
                                    className="h-11 bg-background border-border/70"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">Kategorie</label>
                                <Input
                                    type="text"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    placeholder="z.B. Bar, Küche, Reinigung"
                                    className="h-11 bg-background border-border/70"
                                />
                            </div>
                        </>
                    )}

                    {/* ── Common: Quantity + Unit ───────────────────────── */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Menge</label>
                            <Input
                                type="number"
                                inputMode="decimal"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                min="0"
                                step="any"
                                className="h-11 bg-background border-border/70"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Einheit</label>
                            <Input
                                type="text"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                placeholder="Stück"
                                className="h-11 bg-background border-border/70"
                            />
                        </div>
                    </div>

                    {/* ── Notes ────────────────────────────────────────── */}
                    <div>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Notiz (optional)</label>
                        <Input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="z.B. große Flasche"
                            className="h-11 bg-background border-border/70"
                        />
                    </div>
                </div>

                <DialogFooter className="flex gap-2 mt-2">
                    <Button variant="outline" onClick={handleClose} className="flex-1">Abbrechen</Button>
                    <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-1">
                        <Plus className="w-4 h-4 mr-1" />
                        Hinzufügen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}