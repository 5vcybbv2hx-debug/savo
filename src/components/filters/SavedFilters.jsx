import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, X, Save } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function SavedFilters({ storageKey, currentFilters, onApplyFilter }) {
    const [savedFilters, setSavedFilters] = useState([]);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [filterName, setFilterName] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            setSavedFilters(JSON.parse(saved));
        }
    }, [storageKey]);

    const saveFilter = () => {
        if (!filterName.trim()) return;

        const newFilter = {
            id: Date.now(),
            name: filterName,
            filters: currentFilters
        };

        const updated = [...savedFilters, newFilter];
        setSavedFilters(updated);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setFilterName('');
        setShowSaveDialog(false);
    };

    const deleteFilter = (id) => {
        const updated = savedFilters.filter(f => f.id !== id);
        setSavedFilters(updated);
        localStorage.setItem(storageKey, JSON.stringify(updated));
    };

    const hasActiveFilters = Object.values(currentFilters).some(v => 
        v && v !== '' && v !== 'alle' && (Array.isArray(v) ? v.length > 0 : true)
    );

    if (savedFilters.length === 0 && !hasActiveFilters) return null;

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {savedFilters.map(filter => (
                <Badge
                    key={filter.id}
                    variant="outline"
                    className="pl-2 pr-1 py-1 cursor-pointer hover:bg-surface"
                    onClick={() => onApplyFilter(filter.filters)}
                >
                    <Star className="w-3 h-3 mr-1 fill-status-warn text-status-warn" />
                    {filter.name}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            deleteFilter(filter.id);
                        }}
                        className="ml-1 hover:text-status-danger"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </Badge>
            ))}

            {hasActiveFilters && (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowSaveDialog(true)}
                    className="h-7"
                >
                    <Save className="w-3 h-3 mr-1" />
                    Filter speichern
                </Button>
            )}

            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Filter speichern</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <Input
                            value={filterName}
                            onChange={(e) => setFilterName(e.target.value)}
                            placeholder="z.B. Niedrige Bestände"
                            onKeyPress={(e) => e.key === 'Enter' && saveFilter()}
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setShowSaveDialog(false)} className="flex-1">
                                Abbrechen
                            </Button>
                            <Button onClick={saveFilter} className="flex-1" disabled={!filterName.trim()}>
                                Speichern
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}