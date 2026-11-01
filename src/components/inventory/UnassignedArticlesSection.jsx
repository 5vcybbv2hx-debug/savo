import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ClipboardCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import VirtualizedList from '@/components/ui/virtualized-list';
import ArticleCountRow from './ArticleCountRow';

/**
 * Fallback-Bereich für Artikel ohne aktive StorageAssignment.
 * Behält die bisherige flache Liste mit Suche/Kategorie-Filter bei.
 */
export default function UnassignedArticlesSection({
    articles, counts, categories,
    searchTerm, setSearchTerm,
    filterCategory, setFilterCategory,
    activeArticle, onCountChange
}) {
    const filtered = articles.filter(a => {
        const matchesSearch = a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            a.barcode?.includes(searchTerm);
        const matchesCategory = filterCategory === 'all' || a.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div>
            <h2 className="text-lg font-bold text-foreground mb-3">Nicht zugeordnete Artikel</h2>

            <Card className="p-4 bg-card border-border mb-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Artikel suchen..."
                            className="pl-10 bg-background border-border text-foreground"
                        />
                    </div>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="w-full sm:w-[200px] bg-background border-border text-foreground">
                            <SelectValue placeholder="Kategorie wählen" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Alle Kategorien</SelectItem>
                            {categories.map(cat => (
                                <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </Card>

            {filtered.length > 0 ? (
                <div className="animate-fade-in">
                    <VirtualizedList
                        items={filtered}
                        height={Math.min(filtered.length * 110, 800)}
                        itemHeight={110}
                        renderItem={(article) => (
                            <ArticleCountRow
                                key={article.id}
                                article={article}
                                counted={counts[article.id]}
                                categories={categories}
                                isActive={activeArticle === article.id}
                                onCountChange={onCountChange}
                            />
                        )}
                    />
                </div>
            ) : (
                <div className="text-center py-12">
                    <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                    <p className="text-muted-foreground">
                        {searchTerm || filterCategory !== 'all'
                            ? 'Keine Artikel gefunden'
                            : 'Keine nicht zugeordneten Artikel'}
                    </p>
                </div>
            )}
        </div>
    );
}