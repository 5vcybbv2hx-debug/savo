import { useState } from 'react';
import { Check, MoreVertical, Zap, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import SwipeRow from '@/components/ui/SwipeRow';
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const UNIT_OPTIONS = ['Stück', 'Flaschen', 'Liter', 'ml', 'kg', 'g', 'Kisten', 'Packungen'];

/**
 * Single list item row with:
 *  - round checkbox toggle
 *  - inline quantity edit (tap quantity → input, Enter saves)
 *  - ··· menu with Bearbeiten (dialog) + Löschen
 *  - swipe-to-delete (touch) via SwipeRow
 */
export default function QuickListRow({ item, onToggle, onUpdate, onDelete }) {
    const [editOpen, setEditOpen] = useState(false);
    const [editName, setEditName] = useState(item.item_name);
    const [editQty, setEditQty] = useState(item.quantity);
    const [editUnit, setEditUnit] = useState(item.unit || 'Stück');
    const [editNotes, setEditNotes] = useState(item.notes || '');
    const [qtyEditing, setQtyEditing] = useState(false);
    const [qtyValue, setQtyValue] = useState(item.quantity);

    const openEdit = () => {
        setEditName(item.item_name);
        setEditQty(item.quantity);
        setEditUnit(item.unit || 'Stück');
        setEditNotes(item.notes || '');
        setEditOpen(true);
    };

    const saveEdit = () => {
        onUpdate(item.id, {
            item_name: editName.trim() || item.item_name,
            quantity: Number(editQty) || 1,
            unit: editUnit,
            notes: editNotes.trim() || null,
        });
        setEditOpen(false);
    };

    const startQtyEdit = () => {
        setQtyValue(item.quantity);
        setQtyEditing(true);
    };

    const saveInlineQty = () => {
        const n = Number(qtyValue);
        if (!isNaN(n) && n > 0 && n !== item.quantity) {
            onUpdate(item.id, { quantity: n });
        }
        setQtyEditing(false);
    };

    return (
        <>
            <SwipeRow
                onSwipe={() => onDelete(item.id)}
                revealColor="bg-destructive"
                revealIcon={Trash2}
                className="rounded-xl"
                contentClassName={cn(
                    'flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50',
                    item.is_completed && 'opacity-50'
                )}
            >
                {/* Checkbox */}
                <button
                    onClick={() => onToggle(item)}
                    className={cn(
                        'w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all active:scale-90',
                        item.is_completed
                            ? 'bg-green-600 border-green-600'
                            : 'border-border/70 hover:border-green-500'
                    )}
                >
                    {item.is_completed && <Check className="w-4 h-4 text-white" />}
                </button>

                {/* Image */}
                {item.article_image_url && (
                    <img
                        src={item.article_image_url}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover border border-border/40 shrink-0"
                        loading="lazy"
                    />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className={cn(
                        'text-sm font-medium truncate',
                        item.is_completed ? 'text-muted-foreground line-through' : 'text-foreground'
                    )}>
                        {item.item_name}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        {qtyEditing && !item.is_completed ? (
                            <input
                                type="number"
                                inputMode="decimal"
                                value={qtyValue}
                                onChange={(e) => setQtyValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveInlineQty();
                                    if (e.key === 'Escape') setQtyEditing(false);
                                }}
                                onBlur={saveInlineQty}
                                autoFocus
                                className="w-14 h-6 text-center rounded bg-background border border-border/70 text-xs"
                            />
                        ) : (
                            <button
                                onClick={startQtyEdit}
                                disabled={item.is_completed}
                                className="font-semibold hover:text-primary transition-colors"
                            >
                                {item.quantity} {item.unit}
                            </button>
                        )}
                        {item.added_by_name && (
                            <>
                                <span>·</span>
                                <span>{item.added_by_name}</span>
                            </>
                        )}
                        {item._offline && (
                            <span className="flex items-center gap-0.5 text-yellow-500">
                                <Zap className="w-3 h-3" /> offline
                            </span>
                        )}
                    </div>
                    {item.notes && !item.is_completed && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic truncate">{item.notes}</p>
                    )}
                </div>

                {/* ··· menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 transition-colors">
                            <MoreVertical className="w-4 h-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={openEdit}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onDelete(item.id)}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Löschen
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SwipeRow>

            {/* Edit Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Bearbeiten</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Name</label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-11" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">Menge</label>
                                <Input
                                    type="number"
                                    inputMode="decimal"
                                    value={editQty}
                                    onChange={(e) => setEditQty(e.target.value)}
                                    className="h-11"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">Einheit</label>
                                <select
                                    value={editUnit}
                                    onChange={(e) => setEditUnit(e.target.value)}
                                    className="w-full h-11 rounded-lg bg-background border border-border/70 text-sm px-3"
                                >
                                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Notiz</label>
                            <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="h-11" placeholder="optional" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Abbrechen</Button>
                        <Button onClick={saveEdit}>Speichern</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}