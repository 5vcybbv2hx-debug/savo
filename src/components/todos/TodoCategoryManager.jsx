import React, { useState } from 'react';
import { Plus, Trash2, Tag, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const DEFAULT_CATEGORIES = ['Einkauf', 'Reparatur', 'Event', 'Bar', 'Lager', 'Küche', 'Sonstiges'];

// Helper für andere Komponenten die Kategorien brauchen
export function loadCategories() {
    return DEFAULT_CATEGORIES;
}

export default function TodoCategoryManager({ open, onClose }) {
    const queryClient = useQueryClient();
    const [newCategory, setNewCategory] = useState('');

    const { data: dbCategories = [], isLoading: isLoadingDb } = useQuery({
        queryKey: ['todo-categories'],
        queryFn: () => base44.entities.TodoCategory.list('name'),
        enabled: open
    });

    const { data: allTodoItems = [], isLoading: isLoadingTodos } = useQuery({
        queryKey: ['todos'],
        queryFn: () => base44.entities.TodoItem.list('-created_date', 500),
        enabled: open
    });

    const isLoading = isLoadingDb || isLoadingTodos;

    // Alle Kategorien aus Todos die nicht in DEFAULT_CATEGORIES sind
    const todoCategoryNames = Array.from(new Set(
        allTodoItems.map(t => t.category).filter(Boolean)
    ));
    const extraFromTodos = todoCategoryNames
        .filter(name => !DEFAULT_CATEGORIES.includes(name))
        .filter(name => !dbCategories.some(c => c.name === name))
        .map(name => ({ id: null, name, fromTodos: true }));

    const categories = [...dbCategories, ...extraFromTodos];

    const createMutation = useMutation({
        mutationFn: (name) => base44.entities.TodoCategory.create({ name, is_active: true }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['todo-categories'] });
            toast.success('Kategorie hinzugefügt');
            setNewCategory('');
        },
        onError: () => toast.error('Fehler beim Hinzufügen')
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.TodoCategory.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['todo-categories'] });
            queryClient.invalidateQueries({ queryKey: ['todos'] });
            toast.success('Kategorie gelöscht');
        },
        onError: () => toast.error('Fehler beim Löschen')
    });

    // Löscht Kategorie aus allen Todos (setzt category auf null)
    const deleteTodoCategoryMutation = useMutation({
        mutationFn: async (categoryName) => {
            const affected = allTodoItems.filter(t => t.category === categoryName);
            for (const todo of affected) {
                await base44.entities.TodoItem.update(todo.id, { category: null });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['todos'] });
            toast.success('Kategorie entfernt');
        },
        onError: () => toast.error('Fehler beim Löschen')
    });

    const handleAdd = () => {
        const trimmed = newCategory.trim();
        if (!trimmed) return;
        const exists = categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase()) ||
                       DEFAULT_CATEGORIES.some(c => c.toLowerCase() === trimmed.toLowerCase());
        if (exists) { toast.error('Kategorie existiert bereits'); return; }
        createMutation.mutate(trimmed);
    };

    const handleDelete = (cat) => {
        const openTodos = allTodoItems.filter(t =>
            t.category === cat.name && t.status !== 'erledigt' && !t.is_archived
        );
        if (openTodos.length > 0) {
            if (!confirm(`Es gibt noch ${openTodos.length} offene Aufgabe(n) in dieser Kategorie. Trotzdem löschen?`)) return;
        }
        deleteMutation.mutate(cat.id);
    };

    // Alle anzeigen: Standard + aus DB
    const dbNames = categories.map(c => c.name);
    const allStandard = DEFAULT_CATEGORIES.map(name => ({ name, isDefault: true }));
    const customCategories = categories.filter(c => !DEFAULT_CATEGORIES.includes(c.name));

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tag className="w-5 h-5" />
                        Kategorien verwalten
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    {/* Add new */}
                    <div className="flex gap-2">
                        <Input
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="Neue Kategorie..."
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
                        />
                        <Button
                            onClick={handleAdd}
                            size="icon"
                            className="shrink-0 bg-status-warn/70 hover:bg-status-warn/70 text-muted-foreground"
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        </Button>
                    </div>

                    {/* List */}
                    {isLoading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
                            {/* Standardkategorien */}
                            <p className="text-[13.5px] font-medium text-foreground tracking-tight px-1 mb-1">Standard</p>
                            {allStandard.map(cat => (
                                <div key={cat.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border/50">
                                    <span className="text-sm text-foreground">{cat.name}</span>
                                    <span className="text-[10px] text-muted-foreground">geschützt</span>
                                </div>
                            ))}

                            {/* Eigene Kategorien */}
                            {customCategories.length > 0 && (
                                <>
                                    <p className="text-[13.5px] font-medium text-foreground tracking-tight px-1 mt-3 mb-1">Eigene</p>
                                    {customCategories.map(cat => {
                                        const openCount = allTodoItems.filter(t =>
                                            t.category === cat.name && t.status !== 'erledigt' && !t.is_archived
                                        ).length;
                                        return (
                                            <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border/50">
                                                <div>
                                                    <span className="text-sm text-foreground">{cat.name}</span>
                                                    {openCount > 0 && (
                                                        <span className="ml-2 text-[10px] text-status-warn">{openCount} offen</span>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        if (cat.id) {
                                                            handleDelete(cat);
                                                        } else {
                                                            if (!confirm(`Kategorie "${cat.name}" aus allen Aufgaben entfernen? Die Aufgaben bleiben erhalten, verlieren aber diese Kategorie.`)) return;
                                                            deleteTodoCategoryMutation.mutate(cat.name);
                                                        }
                                                    }}
                                                    disabled={deleteMutation.isPending || deleteTodoCategoryMutation.isPending}
                                                    className="h-7 w-7 text-status-danger hover:text-status-danger/25"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </>
                            )}

                            {customCategories.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-3">Noch keine eigenen Kategorien</p>
                            )}
                        </div>
                    )}

                    <Button variant="outline" onClick={onClose} className="w-full">
                        Fertig
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}