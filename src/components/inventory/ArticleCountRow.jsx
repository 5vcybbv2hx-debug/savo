import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import CountInput from './CountInput';
import { cn } from "@/lib/utils";

/**
 * Einzelne Artikel-Zeile für den "Nicht zugeordnete Artikel"-Bereich.
 * Identisches Layout zur bisherigen flachen Inventur-Liste.
 */
export default function ArticleCountRow({ article, counted, categories, isActive, onCountChange }) {
    const systemStock = article.current_stock || 0;
    const diff = counted !== undefined ? counted - systemStock : 0;
    const hasDiff = counted !== undefined && diff !== 0;
    const cat = categories.find(c => c.name === article.category);

    return (
        <Card
            id={`article-${article.id}`}
            className={cn(
                "p-4 bg-card border-border transition-all mx-0 my-1",
                isActive && "ring-2 ring-blue-500",
                counted !== undefined && "bg-card/50"
            )}
        >
            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-foreground">{article.name}</h3>
                        {hasDiff && (
                            <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                {diff > 0 ? '+' : ''}{diff}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {article.barcode && (
                            <span className="font-mono">{article.barcode}</span>
                        )}
                        {article.category && (
                            <Badge
                                variant="outline"
                                style={{ borderColor: cat?.color, color: cat?.color }}
                            >
                                {article.category}
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-1">Soll</p>
                        <p className="text-lg font-semibold text-foreground/75">{systemStock}</p>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <p className="text-sm text-muted-foreground">Ist</p>
                        <CountInput
                            value={counted}
                            onChange={(v) => onCountChange(article.id, v)}
                        />
                    </div>

                    {counted !== undefined && (
                        <div className={cn(
                            "text-center min-w-[50px]",
                            diff > 0 && "text-green-400",
                            diff < 0 && "text-red-400",
                            diff === 0 && "text-muted-foreground"
                        )}>
                            <p className="text-sm mb-1">Diff</p>
                            <p className="text-lg font-bold">
                                {diff > 0 ? '+' : ''}{diff}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}