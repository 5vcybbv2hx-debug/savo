import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, CheckCircle2, Lightbulb, Edit } from 'lucide-react';

const statusColors = {
    'Idee': 'bg-primary/15 text-primary',
    'geplant': 'bg-status-warn/15 text-status-warn',
    'verworfen': 'bg-secondary/50 text-foreground',
    'umgesetzt': 'bg-status-ok/15 text-status-ok'
};

const priorityColors = {
    'niedrig': 'text-muted-foreground',
    'mittel': 'text-status-warn',
    'hoch': 'text-status-warn',
    'sehr_hoch': 'text-status-danger'
};

const effortColors = {
    'niedrig': 'bg-status-ok/20 text-status-ok/25 border-status-ok/30',
    'mittel': 'bg-status-warn/20 text-status-warn/25 border-status-warn/30',
    'hoch': 'bg-status-danger/20 text-status-danger/25 border-status-danger/30'
};

export default function EventIdeas({ 
    ideas = [], 
    onAdd, 
    onEdit, 
    onDelete, 
    onConvertToEvent,
    isLoading = false 
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('alle');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedIdea, setSelectedIdea] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        category: 'Party',
        description: '',
        estimated_effort: 'mittel',
        priority: 'mittel',
        status: 'Idee',
        notes: ''
    });

    const filteredIdeas = ideas.filter(idea => {
        const matchesSearch = idea.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'alle' || idea.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const openModal = (idea = null) => {
        if (idea) {
            setSelectedIdea(idea);
            setFormData({
                title: idea.title,
                category: idea.category || 'Party',
                description: idea.description || '',
                estimated_effort: idea.estimated_effort || 'mittel',
                priority: idea.priority || 'mittel',
                status: idea.status || 'Idee',
                notes: idea.notes || ''
            });
        } else {
            setSelectedIdea(null);
            setFormData({
                title: '',
                category: 'Party',
                description: '',
                estimated_effort: 'mittel',
                priority: 'mittel',
                status: 'Idee',
                notes: ''
            });
        }
        setModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (selectedIdea) {
            onEdit({ id: selectedIdea.id, data: formData });
        } else {
            onAdd(formData);
        }
        setModalOpen(false);
    };

    return (
        <div className="space-y-4">
            {/* Filter & Action Bar */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                        placeholder="Idee suchen..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 bg-background border-border"
                    />
                    <Button
                        onClick={() => openModal()}
                        className="bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary text-foreground text-xs h-10"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Neue Idee</span>
                        <span className="sm:hidden">+</span>
                    </Button>
                </div>

                {/* Status Filter */}
                <div className="flex flex-wrap gap-2">
                    {['alle', 'Idee', 'geplant', 'umgesetzt', 'verworfen'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                                statusFilter === status
                                    ? 'bg-primary/70 text-foreground border-primary/70'
                                    : 'bg-card text-foreground/75 border-border hover:border-border/70'
                            )}
                        >
                            {status === 'alle' ? 'Alle' : status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Ideas Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredIdeas.map(idea => (
                    <Card 
                        key={idea.id}
                        className="bg-card border-border flex flex-col"
                    >
                        <CardHeader className="pb-2">
                            <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <CardTitle className="text-base text-foreground flex-1 line-clamp-2">
                                        {idea.title}
                                    </CardTitle>
                                    <Badge className={statusColors[idea.status]}>
                                        {idea.status}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="bg-secondary text-foreground/80 border-border/70 text-xs">
                                        {idea.category}
                                    </Badge>
                                    <div className={cn("text-xs font-semibold", priorityColors[idea.priority])}>
                                        ★ {idea.priority === 'niedrig' ? 'Niedrig' : idea.priority === 'mittel' ? 'Mittel' : idea.priority === 'hoch' ? 'Hoch' : 'Sehr Hoch'}
                                    </div>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="flex-1 space-y-3">
                            {idea.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {idea.description}
                                </p>
                            )}

                            <div className="flex items-center gap-2">
                                <span className={cn("px-2 py-1 rounded text-xs border", effortColors[idea.estimated_effort])}>
                                    Aufwand: {idea.estimated_effort === 'niedrig' ? 'Niedrig' : idea.estimated_effort === 'mittel' ? 'Mittel' : 'Hoch'}
                                </span>
                            </div>

                            {idea.notes && (
                                <p className="text-xs text-foreground0 italic">
                                    {idea.notes}
                                </p>
                            )}

                            <div className="flex gap-2 pt-2 border-t border-border">
                                {idea.status !== 'umgesetzt' && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => onConvertToEvent(idea)}
                                        className="flex-1 text-status-ok hover:text-status-ok/25 hover:bg-status-ok/10 text-xs"
                                    >
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Umwandeln
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openModal(idea)}
                                    className="flex-1 text-foreground/75 hover:text-status-warn hover:bg-status-warn/10 text-xs"
                                >
                                    <Edit className="w-3 h-3 mr-1" />
                                    <span className="hidden sm:inline">Bearbeiten</span>
                                    <span className="sm:hidden">B.</span>
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onDelete(idea.id)}
                                    className="flex-1 text-status-danger hover:text-status-danger/25 hover:bg-status-danger/10 text-xs"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredIdeas.length === 0 && (
                <Card className="p-8 bg-card border-border">
                    <div className="text-center text-muted-foreground">
                        <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Keine Eventideen gefunden</p>
                    </div>
                </Card>
            )}

            {/* Modal */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedIdea ? 'Idee bearbeiten' : 'Neue Eventidee'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label>Titel *</Label>
                            <Input
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="z.B. 80s Retro Night"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Kategorie</Label>
                                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Party">Party</SelectItem>
                                        <SelectItem value="Livemusik">Livemusik</SelectItem>
                                        <SelectItem value="DJ-Night">DJ-Night</SelectItem>
                                        <SelectItem value="Special Event">Special Event</SelectItem>
                                        <SelectItem value="Private Feier">Private Feier</SelectItem>
                                        <SelectItem value="Sonstiges">Sonstiges</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Idee">Idee</SelectItem>
                                        <SelectItem value="geplant">Geplant</SelectItem>
                                        <SelectItem value="umgesetzt">Umgesetzt</SelectItem>
                                        <SelectItem value="verworfen">Verworfen</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Beschreibung</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Details der Idee..."
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Priorität</Label>
                                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="niedrig">Niedrig</SelectItem>
                                        <SelectItem value="mittel">Mittel</SelectItem>
                                        <SelectItem value="hoch">Hoch</SelectItem>
                                        <SelectItem value="sehr_hoch">Sehr Hoch</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Aufwand</Label>
                                <Select value={formData.estimated_effort} onValueChange={(v) => setFormData({ ...formData, estimated_effort: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="niedrig">Niedrig</SelectItem>
                                        <SelectItem value="mittel">Mittel</SelectItem>
                                        <SelectItem value="hoch">Hoch</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Notizen</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Zusätzliche Infos..."
                                rows={2}
                            />
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1 border-border text-foreground/75 hover:bg-card">
                                Abbrechen
                            </Button>
                            <Button type="submit" className="flex-1 bg-primary/70 hover:bg-primary/70 text-foreground">
                                {selectedIdea ? 'Speichern' : 'Hinzufügen'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}