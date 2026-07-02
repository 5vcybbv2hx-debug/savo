import React, { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
    Search, Wine, Users, Package, Calendar, CheckSquare, 
    Sparkles, BookOpen, Clock, FileText, Command, MapPin, Warehouse
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GlobalSearch({ open, onClose }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [focusedIdx, setFocusedIdx] = useState(0);
    const inputRef = useRef(null);
    const resultsRef = useRef([]);
    const navigate = useNavigate();

    const { data: articles = [] } = useQuery({
        queryKey: ['articles'],
        queryFn: () => base44.entities.Article.list(),
        enabled: open
    });

    const { data: recipes = [] } = useQuery({
        queryKey: ['recipes'],
        queryFn: () => base44.entities.Recipe.list(),
        enabled: open
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['employees'],
        queryFn: () => base44.entities.Employee.filter({ is_active: true }),
        enabled: open
    });

    const { data: menuItems = [] } = useQuery({
        queryKey: ['menu-items'],
        queryFn: () => base44.entities.MenuItem.list(),
        enabled: open
    });

    const { data: todos = [] } = useQuery({
        queryKey: ['todos'],
        queryFn: () => base44.entities.TodoItem.filter({ is_archived: false }),
        enabled: open
    });

    const { data: storageItems = [] } = useQuery({
        queryKey: ['storage-items'],
        queryFn: () => base44.entities.StorageItem.filter({ is_active: true }),
        enabled: open
    });

    const { data: storageAssignments = [] } = useQuery({
        queryKey: ['storage-assignments'],
        queryFn: () => base44.entities.StorageAssignment.filter({ is_active: true }, 'article_name', 1000),
        enabled: open
    });

    const assignmentMap = useMemo(() => {
        const map = {};
        for (const a of storageAssignments) {
            if (!map[a.article_id]) map[a.article_id] = [];
            map[a.article_id].push(a);
        }
        return map;
    }, [storageAssignments]);

    // Reset on open/close
    useEffect(() => {
        if (open) {
            setSearchTerm('');
            setFocusedIdx(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Keyboard shortcut (Ctrl/Cmd + K)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                // This will be triggered from the parent
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const pages = [
        { name: 'Kalender', page: 'Calendar', icon: Calendar, keywords: ['schichten', 'termine'] },
        { name: 'Mitarbeiter', page: 'Employees', icon: Users, keywords: ['team', 'personal'] },
        { name: 'Lager', page: 'Warehouse', icon: Package, keywords: ['artikel', 'bestand', 'inventory'] },
        { name: 'Getränkekarte', page: 'DrinkMenu', icon: Wine, keywords: ['drinks', 'cocktails', 'menu'] },
        { name: 'Rezepte', page: 'Recipes', icon: BookOpen, keywords: ['cocktails', 'zutaten'] },
        { name: 'Aufgaben', page: 'Todos', icon: CheckSquare, keywords: ['todos', 'tasks'] },
        { name: 'Putzen', page: 'Cleaning', icon: Sparkles, keywords: ['reinigung', 'cleaning'] },
        { name: 'Zeiterfassung', page: 'TimeManagement', icon: Clock, keywords: ['stunden', 'time'] },
        { name: 'Berichte', page: 'Reports', icon: FileText, keywords: ['analytics', 'reports'] },
    ];

    const searchResults = searchTerm.length >= 2 ? {
        pages: pages.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.keywords.some(k => k.includes(searchTerm.toLowerCase()))
        ),
        articles: articles.filter(a => {
            const q = searchTerm.toLowerCase();
            const aAssignments = assignmentMap[a.id] || [];
            return a.name?.toLowerCase().includes(q) ||
                a.barcode?.includes(q) ||
                aAssignments.some(asgn => asgn.slot_full_name?.toLowerCase().includes(q));
        }).slice(0, 6),
        storageItems: storageItems.filter(s =>
            s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.location_label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.category?.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 6),
        recipes: recipes.filter(r => 
            r.name?.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 5),
        employees: employees.filter(e => 
            e.name?.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 5),
        menuItems: menuItems.filter(m => 
            m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.description?.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 5),
        todos: todos.filter(t => 
            t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.description?.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 5)
    } : { pages: [], articles: [], recipes: [], employees: [], menuItems: [], todos: [], storageItems: [] };

    const hasResults = Object.values(searchResults).some(arr => arr.length > 0);

    // Flat list for keyboard nav
    const flatResults = [
        ...searchResults.pages.map(p => ({ type: 'page', item: p, path: createPageUrl(p.page) })),
        ...searchResults.articles.map(a => ({ type: 'article', item: a, path: createPageUrl('Warehouse') })),
        ...searchResults.storageItems.map(s => ({ type: 'storage', item: s, path: createPageUrl('Storage') })),
        ...searchResults.menuItems.map(m => ({ type: 'menu', item: m, path: createPageUrl('DrinkMenu') })),
        ...searchResults.recipes.map(r => ({ type: 'recipe', item: r, path: createPageUrl('Recipes') })),
        ...searchResults.employees.map(e => ({ type: 'employee', item: e, path: createPageUrl('Employees') })),
        ...searchResults.todos.map(t => ({ type: 'todo', item: t, path: createPageUrl('Todos') })),
    ];

    const handleNavigate = (path) => {
        navigate(path);
        onClose();
        setSearchTerm('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIdx(i => Math.min(i + 1, flatResults.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIdx(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && flatResults[focusedIdx]) {
            handleNavigate(flatResults[focusedIdx].path);
        }
    };

    useEffect(() => {
        setFocusedIdx(0);
    }, [searchTerm]);

    useEffect(() => {
        resultsRef.current[focusedIdx]?.scrollIntoView({ block: 'nearest' });
    }, [focusedIdx]);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
                <div className="border-b border-border p-3 sm:p-4 flex items-center gap-3">
                    <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                    <Input
                        ref={inputRef}
                        placeholder="Artikel, Lager, Rezepte, Mitarbeiter..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base h-10"
                    />
                    {searchTerm ? (
                        <button onClick={() => setSearchTerm('')} className="text-muted-foreground hover:text-foreground shrink-0 text-xl leading-none">×</button>
                    ) : (
                        <Badge variant="outline" className="text-xs hidden sm:flex shrink-0">
                            <Command className="w-3 h-3 mr-1" />K
                        </Badge>
                    )}
                </div>

                <div className="max-h-[60vh] sm:max-h-[500px] overflow-y-auto">
                    {searchTerm.length < 2 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
                            <p className="text-sm">Mindestens 2 Zeichen eingeben</p>
                        </div>
                    ) : !hasResults ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
                            <p className="text-sm">Keine Ergebnisse für &ldquo;{searchTerm}&rdquo;</p>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {(() => {
                                let globalIdx = 0;
                                const sections = [
                                    { key: 'pages', label: 'Seiten', icon: null, color: '', items: searchResults.pages,
                                      render: (p, idx, focused) => (
                                        <button key={p.page} ref={el => resultsRef.current[idx] = el}
                                            onClick={() => handleNavigate(createPageUrl(p.page))}
                                            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left', focused ? 'bg-accent' : 'hover:bg-accent/60')}>
                                            <p.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                                            <span className="font-medium text-sm">{p.name}</span>
                                        </button>
                                      )
                                    },
                                    { key: 'articles', label: 'Artikel (Inventar)', items: searchResults.articles,
                                      render: (a, idx, focused) => (
                                        <button key={a.id} ref={el => resultsRef.current[idx] = el}
                                            onClick={() => handleNavigate(createPageUrl('Warehouse'))}
                                            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left', focused ? 'bg-accent' : 'hover:bg-accent/60')}>
                                            <Package className="w-4 h-4 text-blue-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{a.name}</p>
                                                {(() => {
                                                    const aAssignments = assignmentMap[a.id] || [];
                                                    if (aAssignments.length === 0) return null;
                                                    const shown = aAssignments.slice(0, 2).map(a => a.slot_full_name).filter(Boolean);
                                                    const extra = aAssignments.length - 2;
                                                    return (
                                                        <p className="flex items-center gap-1 text-xs text-blue-400 font-semibold mt-0.5">
                                                            <MapPin className="w-3 h-3 shrink-0" />
                                                            {shown.join(' · ')}{extra > 0 ? ` +${extra}` : ''}
                                                        </p>
                                                    );
                                                })()}
                                            </div>
                                            {a.current_stock !== undefined && (
                                                <Badge variant={a.current_stock <= (a.min_stock || 0) ? 'destructive' : 'outline'} className="shrink-0 text-xs">{a.current_stock}</Badge>
                                            )}
                                        </button>
                                      )
                                    },
                                    { key: 'storageItems', label: 'Lagerartikel', items: searchResults.storageItems,
                                      render: (s, idx, focused) => (
                                        <button key={s.id} ref={el => resultsRef.current[idx] = el}
                                            onClick={() => handleNavigate(createPageUrl('Storage'))}
                                            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left', focused ? 'bg-accent' : 'hover:bg-accent/60')}>
                                            <Warehouse className="w-4 h-4 text-violet-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{s.name}</p>
                                                {s.location_label && (
                                                    <p className="flex items-center gap-1 text-xs text-violet-400 font-semibold mt-0.5">
                                                        <MapPin className="w-3 h-3 shrink-0" />{s.location_label}
                                                    </p>
                                                )}
                                            </div>
                                            <Badge variant={s.condition === 'defekt' ? 'destructive' : 'outline'} className="shrink-0 text-xs">{s.condition || 'gut'}</Badge>
                                        </button>
                                      )
                                    },
                                    { key: 'menuItems', label: 'Getränke', items: searchResults.menuItems,
                                      render: (m, idx, focused) => (
                                        <button key={m.id} ref={el => resultsRef.current[idx] = el}
                                            onClick={() => handleNavigate(createPageUrl('DrinkMenu'))}
                                            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left', focused ? 'bg-accent' : 'hover:bg-accent/60')}>
                                            <Wine className="w-4 h-4 text-amber-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{m.name}</p>
                                                <p className="text-xs text-muted-foreground">{m.category}</p>
                                            </div>
                                            {m.price != null && <Badge variant="outline" className="shrink-0 text-xs">{Number(m.price).toFixed(2)} €</Badge>}
                                        </button>
                                      )
                                    },
                                    { key: 'recipes', label: 'Rezepte', items: searchResults.recipes,
                                      render: (r, idx, focused) => (
                                        <button key={r.id} ref={el => resultsRef.current[idx] = el}
                                            onClick={() => handleNavigate(createPageUrl('Recipes'))}
                                            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left', focused ? 'bg-accent' : 'hover:bg-accent/60')}>
                                            <BookOpen className="w-4 h-4 text-pink-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{r.name}</p>
                                                <p className="text-xs text-muted-foreground">{r.category}</p>
                                            </div>
                                        </button>
                                      )
                                    },
                                    { key: 'employees', label: 'Mitarbeiter', items: searchResults.employees,
                                      render: (e, idx, focused) => (
                                        <button key={e.id} ref={el => resultsRef.current[idx] = el}
                                            onClick={() => handleNavigate(createPageUrl('Employees'))}
                                            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left', focused ? 'bg-accent' : 'hover:bg-accent/60')}>
                                            <Users className="w-4 h-4 text-green-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{e.name}</p>
                                                <p className="text-xs text-muted-foreground">{e.role}</p>
                                            </div>
                                        </button>
                                      )
                                    },
                                    { key: 'todos', label: 'Aufgaben', items: searchResults.todos,
                                      render: (t, idx, focused) => (
                                        <button key={t.id} ref={el => resultsRef.current[idx] = el}
                                            onClick={() => handleNavigate(createPageUrl('Todos'))}
                                            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left', focused ? 'bg-accent' : 'hover:bg-accent/60')}>
                                            <CheckSquare className="w-4 h-4 text-orange-500 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{t.title}</p>
                                                {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                                            </div>
                                            <Badge variant={t.priority === 'dringend' || t.priority === 'hoch' ? 'destructive' : 'outline'} className="shrink-0 text-xs">{t.priority}</Badge>
                                        </button>
                                      )
                                    },
                                ];
                                return sections.map(section => {
                                    if (!section.items?.length) return null;
                                    return (
                                        <div key={section.key}>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 pt-3 pb-1">{section.label}</p>
                                            {section.items.map(item => {
                                                const idx = globalIdx++;
                                                return section.render(item, idx, focusedIdx === idx);
                                            })}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )}
                </div>

                <div className="border-t border-border p-3 flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">↑</kbd>
                            <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">↓</kbd>
                            Navigation
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">Enter</kbd>
                            Öffnen
                        </span>
                    </div>
                    <span className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">Esc</kbd>
                        Schließen
                    </span>
                </div>
            </DialogContent>
        </Dialog>
    );
}