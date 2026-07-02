import React, { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown, Check } from "lucide-react";

/**
 * Single-select searchable combobox for linking a Recipe to a menu item.
 * Replaces the old plain <Select> dropdown with a live-search list.
 */
export default function RecipeSearchSelect({ recipes = [], value, onChange, placeholder = "Rezept auswählen…" }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    const selectedRecipe = recipes.find(r => r.id === value) || null;

    const filtered = recipes.filter(r =>
        !search || r.name?.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setSearch("");
            }
        }
        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [open]);

    const openDropdown = () => {
        setOpen(true);
        setSearch("");
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const selectRecipe = (recipe) => {
        onChange(recipe.id);
        setOpen(false);
        setSearch("");
    };

    const clearSelection = (e) => {
        e.stopPropagation();
        onChange("");
        setSearch("");
    };

    return (
        <div className="relative" ref={containerRef}>
            {!open ? (
                <button
                    type="button"
                    onClick={openDropdown}
                    className="w-full h-12 px-3 flex items-center justify-between text-base rounded-xl border border-border/70 bg-background focus:border-primary text-left"
                >
                    <span className={selectedRecipe ? "text-foreground" : "text-muted-foreground"}>
                        {selectedRecipe ? selectedRecipe.name : placeholder}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                        {selectedRecipe && (
                            <span
                                onClick={clearSelection}
                                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </span>
                        )}
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </span>
                </button>
            ) : (
                <div className="relative">
                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                    <input
                        ref={inputRef}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Rezept suchen…"
                        className="w-full h-12 pl-9 pr-3 text-base rounded-xl border border-primary bg-background placeholder:text-muted-foreground focus:outline-none"
                    />
                </div>
            )}

            {open && (
                <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-border/60 bg-popover shadow-lg divide-y divide-border/30">
                    <button
                        type="button"
                        onClick={() => selectRecipe({ id: "", name: "" })}
                        className="w-full text-left px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                        Kein Rezept
                    </button>
                    {filtered.length === 0 && (
                        <p className="text-sm text-muted-foreground p-4 text-center">Keine Rezepte gefunden.</p>
                    )}
                    {filtered.slice(0, 50).map(recipe => {
                        const isSelected = recipe.id === value;
                        return (
                            <button
                                key={recipe.id}
                                type="button"
                                onClick={() => selectRecipe(recipe)}
                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
                                    isSelected ? "bg-primary/5 font-semibold text-primary" : "text-foreground hover:bg-muted/50"
                                }`}
                            >
                                <span>
                                    {recipe.name}
                                    {recipe.category && <span className="ml-2 text-xs text-muted-foreground">{recipe.category}</span>}
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}