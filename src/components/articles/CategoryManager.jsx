import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16', 
    '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
    '#6366f1', '#8b5cf6', '#a855f7', '#ec4899'
];

export default function CategoryManager() {
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        color: PRESET_COLORS[0],
        order: 0
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['article-categories'],
        queryFn: () => base44.entities.ArticleCategory.list('order')
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.ArticleCategory.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['article-categories']);
            closeModal();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.ArticleCategory.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['article-categories']);
            closeModal();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.ArticleCategory.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['article-categories']);
        }
    });

    const openModal = (category = null) => {
        if (category) {
            setSelectedCategory(category);
            setFormData({
                name: category.name,
                color: category.color || PRESET_COLORS[0],
                order: category.order || 0
            });
        } else {
            setSelectedCategory(null);
            setFormData({
                name: '',
                color: PRESET_COLORS[0],
                order: categories.length
            });
        }
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedCategory(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (selectedCategory) {
            updateMutation.mutate({ id: selectedCategory.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleDelete = (id) => {
        if (confirm('Kategorie wirklich löschen?')) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <>
            <Button
                variant="outline"
                onClick={() => openModal()}
                className="border-border/70 hover:bg-secondary text-foreground/75"
            >
                <Tag className="w-4 h-4 mr-2" />
                Kategorien
            </Button>

            <Dialog open={modalOpen} onOpenChange={closeModal}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Kategorien verwalten</DialogTitle>
                    </DialogHeader>

                    {/* Existing Categories */}
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {categories.map(cat => (
                            <div key={cat.id} className="flex items-center gap-3 p-3 bg-card rounded-lg">
                                <div 
                                    className="w-6 h-6 rounded-full"
                                    style={{ backgroundColor: cat.color || '#64748b' }}
                                />
                                <span className="flex-1 font-medium">{cat.name}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openModal(cat)}
                                    className="h-8 w-8"
                                >
                                    <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(cat.id)}
                                    className="h-8 w-8 text-status-danger"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    {/* Add/Edit Form */}
                    <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t">
                        <h3 className="font-semibold">
                            {selectedCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
                        </h3>

                        <div className="space-y-2">
                            <Label>Name *</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="z.B. Cocktails"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Farbe</Label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_COLORS.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, color })}
                                        className={`w-8 h-8 rounded-full transition-transform ${
                                            formData.color === color ? 'ring-2 ring-offset-2 border-border scale-110' : ''
                                        }`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={closeModal} className="flex-1">
                                Abbrechen
                            </Button>
                            <Button type="submit" className="flex-1 bg-status-warn/70 hover:bg-status-warn/70">
                                {selectedCategory ? 'Speichern' : 'Hinzufügen'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}